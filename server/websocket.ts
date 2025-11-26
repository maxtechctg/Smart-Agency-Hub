import { WebSocketServer, WebSocket } from "ws";
import { type Server } from "http";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { users, projects, tasks } from "@shared/schema";
import { eq } from "drizzle-orm";

// Use the same JWT secret as the REST API for consistency
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  userRole?: string;
  isAlive?: boolean;
}

interface WebSocketMessage {
  type: "subscribe" | "unsubscribe" | "message" | "ping";
  projectId?: string;
  content?: string;
}

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private projectSubscriptions: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private userConnections: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: "/ws"
    });

    this.wss.on("connection", async (ws: AuthenticatedWebSocket, req) => {
      console.log("New WebSocket connection attempt");
      
      // Extract token from query string
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const token = url.searchParams.get("token");

      if (!token) {
        console.log("WebSocket connection rejected: No token provided");
        ws.close(1008, "Authentication required");
        return;
      }

      try {
        // Verify JWT token using the same secret as REST API
        const decoded = jwt.verify(token, JWT_SECRET) as {
          userId: string;
          role: string;
        };

        // Verify user exists
        const [user] = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
        if (!user) {
          console.log("WebSocket connection rejected: User not found");
          ws.close(1008, "User not found");
          return;
        }

        ws.userId = decoded.userId;
        ws.userRole = decoded.role;
        ws.isAlive = true;

        // Track user connection for notification broadcasting
        if (!this.userConnections.has(decoded.userId)) {
          this.userConnections.set(decoded.userId, new Set());
        }
        this.userConnections.get(decoded.userId)!.add(ws);

        console.log(`WebSocket authenticated for user: ${user.fullName} (${user.role})`);

        // Handle ping/pong for connection health
        ws.on("pong", () => {
          ws.isAlive = true;
        });

        ws.on("message", (data) => {
          try {
            const message: WebSocketMessage = JSON.parse(data.toString());
            this.handleMessage(ws, message);
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
            ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
          }
        });

        ws.on("close", () => {
          console.log(`WebSocket closed for user: ${ws.userId}`);
          
          // Remove from project subscriptions
          this.projectSubscriptions.forEach((subscribers) => {
            subscribers.delete(ws);
          });
          
          // Remove from user connections
          if (ws.userId) {
            const userConnections = this.userConnections.get(ws.userId);
            if (userConnections) {
              userConnections.delete(ws);
              if (userConnections.size === 0) {
                this.userConnections.delete(ws.userId);
              }
            }
          }
        });

        ws.on("error", (error) => {
          console.error("WebSocket error:", error);
        });

        // AUTO-SUBSCRIBE developers/admins to all their assigned projects (Unified Inbox)
        if (ws.userRole === "developer" || ws.userRole === "admin" || ws.userRole === "operational_head") {
          await this.autoSubscribeToAllProjects(ws);
        }

        // Send welcome message
        ws.send(JSON.stringify({ 
          type: "connected", 
          message: "WebSocket connected successfully",
          userId: ws.userId,
          autoSubscribed: ws.userRole !== "client"
        }));

      } catch (error) {
        console.log("WebSocket authentication failed:", error);
        ws.close(1008, "Authentication failed");
      }
    });

    // Start heartbeat to detect dead connections
    this.startHeartbeat();

    console.log("WebSocket server initialized on path /ws");
  }

  private handleMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    switch (message.type) {
      case "subscribe":
        if (message.projectId) {
          this.subscribeToProject(ws, message.projectId);
        } else {
          // Subscribe to all projects (for developers/admins)
          this.autoSubscribeToAllProjects(ws);
        }
        break;

      case "unsubscribe":
        if (message.projectId) {
          this.unsubscribeFromProject(ws, message.projectId);
        }
        break;

      case "ping":
        ws.send(JSON.stringify({ type: "pong" }));
        break;

      default:
        ws.send(JSON.stringify({ type: "error", message: "Unknown message type" }));
    }
  }

  // Auto-subscribe developers/admins to all their assigned projects
  private async autoSubscribeToAllProjects(ws: AuthenticatedWebSocket) {
    try {
      if (!ws.userId) {
        return;
      }

      // For clients, they must subscribe to specific projects manually
      if (ws.userRole === "client") {
        ws.send(JSON.stringify({ 
          type: "error", 
          message: "Clients must subscribe to specific projects"
        }));
        return;
      }

      // Determine which projects to subscribe to based on role
      let projectIds: string[];
      
      if (ws.userRole === "admin" || ws.userRole === "operational_head") {
        // Admins/ops get all projects (even without assigned tasks)
        const allProjects = await db.select({ id: projects.id }).from(projects);
        projectIds = allProjects.map(p => p.id);
      } else {
        // Developers get only projects they're assigned to via tasks
        const assignedTasks = await db
          .select({ projectId: tasks.projectId })
          .from(tasks)
          .where(eq(tasks.assignedTo, ws.userId));
        
        const uniqueProjectIds = new Set(assignedTasks.map(t => t.projectId));
        projectIds = Array.from(uniqueProjectIds);
      }
      
      if (projectIds.length === 0) {
        ws.send(JSON.stringify({ 
          type: "subscribed_all", 
          message: "No assigned projects found",
          projectCount: 0
        }));
        return;
      }

      // Subscribe to all accessible projects
      let subscribed = 0;
      for (const projectId of projectIds) {
        if (!this.projectSubscriptions.has(projectId)) {
          this.projectSubscriptions.set(projectId, new Set());
        }
        this.projectSubscriptions.get(projectId)!.add(ws);
        subscribed++;
      }

      console.log(`User ${ws.userId} (${ws.userRole}) auto-subscribed to ${subscribed} projects`);
      
      ws.send(JSON.stringify({ 
        type: "subscribed_all", 
        message: `Auto-subscribed to ${subscribed} projects`,
        projectCount: subscribed,
        projectIds
      }));
    } catch (error) {
      console.error("Error auto-subscribing to projects:", error);
      ws.send(JSON.stringify({ 
        type: "error", 
        message: "Failed to auto-subscribe to projects"
      }));
    }
  }

  private async subscribeToProject(ws: AuthenticatedWebSocket, projectId: string) {
    // CLIENT SECURITY: Verify client owns the project before allowing subscription
    if (ws.userRole === "client") {
      try {
        // Get user's clientId
        const [user] = await db.select().from(users).where(eq(users.id, ws.userId!)).limit(1);
        if (!user?.clientId) {
          ws.send(JSON.stringify({ 
            type: "error", 
            message: "No client associated with this user"
          }));
          return;
        }
        
        // Verify client owns this project
        const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
        if (!project) {
          ws.send(JSON.stringify({ 
            type: "error", 
            message: "Project not found"
          }));
          return;
        }
        
        if (project.clientId !== user.clientId) {
          ws.send(JSON.stringify({ 
            type: "error", 
            message: "Access denied: You can only subscribe to your own projects"
          }));
          console.log(`User ${ws.userId} (client) attempted to subscribe to unauthorized project ${projectId}`);
          return;
        }
      } catch (error) {
        console.error("Error verifying project ownership:", error);
        ws.send(JSON.stringify({ 
          type: "error", 
          message: "Failed to verify project access"
        }));
        return;
      }
    }
    
    if (!this.projectSubscriptions.has(projectId)) {
      this.projectSubscriptions.set(projectId, new Set());
    }
    
    this.projectSubscriptions.get(projectId)!.add(ws);
    console.log(`User ${ws.userId} (${ws.userRole}) subscribed to project ${projectId}`);
    
    ws.send(JSON.stringify({ 
      type: "subscribed", 
      projectId,
      message: `Subscribed to project ${projectId}`
    }));
  }

  private unsubscribeFromProject(ws: AuthenticatedWebSocket, projectId: string) {
    const subscribers = this.projectSubscriptions.get(projectId);
    if (subscribers) {
      subscribers.delete(ws);
      console.log(`User ${ws.userId} unsubscribed from project ${projectId}`);
      
      if (subscribers.size === 0) {
        this.projectSubscriptions.delete(projectId);
      }
    }

    ws.send(JSON.stringify({ 
      type: "unsubscribed", 
      projectId,
      message: `Unsubscribed from project ${projectId}`
    }));
  }

  // Broadcast a new message to all subscribers of a project
  public broadcastMessage(projectId: string, message: any) {
    const subscribers = this.projectSubscriptions.get(projectId);
    if (!subscribers || subscribers.size === 0) {
      console.log(`No subscribers for project ${projectId}`);
      return;
    }

    const payload = JSON.stringify({
      type: "new_message",
      projectId,
      message
    });

    let sentCount = 0;
    subscribers.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
        sentCount++;
      }
    });

    console.log(`Broadcasted message to ${sentCount} subscribers in project ${projectId}`);
  }

  // Broadcast a notification to a specific user (all their connected devices/tabs)
  public broadcastNotification(userId: string, notification: any) {
    const userSockets = this.userConnections.get(userId);
    if (!userSockets || userSockets.size === 0) {
      console.log(`No active connections for user ${userId}`);
      return;
    }

    const payload = JSON.stringify({
      type: "notification",
      notification
    });

    let sentCount = 0;
    userSockets.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
        sentCount++;
      }
    });

    console.log(`Broadcasted notification to ${sentCount} connections for user ${userId}`);
  }

  private startHeartbeat() {
    // Ping clients every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;

      this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
        if (ws.isAlive === false) {
          console.log(`Terminating dead connection for user: ${ws.userId}`);
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  public close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.wss) {
      this.wss.close();
    }

    console.log("WebSocket server closed");
  }
}

export const wsService = new WebSocketService();
