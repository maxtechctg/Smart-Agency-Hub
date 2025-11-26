import { db } from "../db";
import { notifications, users, projects, tasks } from "@shared/schema";
import { eq } from "drizzle-orm";
import { wsService } from "../websocket";

export class NotificationService {
  /**
   * Create a notification for a user
   */
  private async createNotification(userId: string, type: string, message: string, projectId?: string) {
    try {
      const [notification] = await db.insert(notifications).values({
        userId,
        type,
        message,
        projectId: projectId || null,
      }).returning();

      // Broadcast the notification via WebSocket
      wsService.broadcastNotification(userId, notification);

      console.log(`Created notification for user ${userId}: ${message}`);
      return notification;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }

  /**
   * Get all users who should be notified for a project
   * Excludes the sender
   */
  private async getProjectNotificationRecipients(projectId: string, senderId: string) {
    try {
      // Get the project details
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!project) {
        return [];
      }

      const recipientSet = new Set<string>();

      // Add project owner (client/buyer) if not the sender
      if (project.clientId) {
        const [clientUser] = await db.select().from(users).where(eq(users.clientId, project.clientId)).limit(1);
        if (clientUser && clientUser.id !== senderId) {
          recipientSet.add(clientUser.id);
        }
      }

      // Add project creator (usually admin/operational head) if not the sender
      if (project.createdBy && project.createdBy !== senderId) {
        recipientSet.add(project.createdBy);
      }

      // Add all developers assigned to tasks in this project (excluding sender)
      const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, projectId));
      for (const task of projectTasks) {
        if (task.assignedTo && task.assignedTo !== senderId) {
          recipientSet.add(task.assignedTo);
        }
      }

      // Convert Set to Array to remove duplicates
      return Array.from(recipientSet);
    } catch (error) {
      console.error("Error getting notification recipients:", error);
      return [];
    }
  }

  /**
   * Notify users when a new chat message is sent
   */
  async notifyNewMessage(projectId: string, senderId: string, messageContent: string) {
    try {
      const recipients = await this.getProjectNotificationRecipients(projectId, senderId);
      const [sender] = await db.select().from(users).where(eq(users.id, senderId)).limit(1);
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

      if (!sender || !project) {
        return;
      }

      // Create notifications for all recipients
      const notifications = [];
      for (const recipientId of recipients) {
        const notification = await this.createNotification(
          recipientId,
          "message",
          `${sender.fullName} sent a message in ${project.name}: "${messageContent.substring(0, 50)}${messageContent.length > 50 ? '...' : ''}"`,
          projectId
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error("Error notifying new message:", error);
    }
  }

  /**
   * Notify users when a file is uploaded to a project
   */
  async notifyFileUpload(projectId: string, uploaderId: string, fileName: string) {
    try {
      const recipients = await this.getProjectNotificationRecipients(projectId, uploaderId);
      const [uploader] = await db.select().from(users).where(eq(users.id, uploaderId)).limit(1);
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

      if (!uploader || !project) {
        return;
      }

      // Create notifications for all recipients
      const notifications = [];
      for (const recipientId of recipients) {
        const notification = await this.createNotification(
          recipientId,
          "file",
          `${uploader.fullName} uploaded a file "${fileName}" to ${project.name}`,
          projectId
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error("Error notifying file upload:", error);
    }
  }

  /**
   * Notify project members when a task is completed
   */
  async notifyTaskCompleted(projectId: string, completedBy: string, taskTitle: string) {
    try {
      const recipients = await this.getProjectNotificationRecipients(projectId, completedBy);
      const [completedByUser] = await db.select().from(users).where(eq(users.id, completedBy)).limit(1);
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

      if (!completedByUser || !project) {
        return;
      }

      // Create notifications for all recipients
      const notifications = [];
      for (const recipientId of recipients) {
        const notification = await this.createNotification(
          recipientId,
          "task_completed",
          `${completedByUser.fullName} completed task "${taskTitle}" in ${project.name}`,
          projectId
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error("Error notifying task completed:", error);
    }
  }

  /**
   * Notify when a project status changes
   */
  async notifyProjectStatusChange(projectId: string, newStatus: string, changedBy: string) {
    try {
      const recipients = await this.getProjectNotificationRecipients(projectId, changedBy);
      const [changedByUser] = await db.select().from(users).where(eq(users.id, changedBy)).limit(1);
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

      if (!changedByUser || !project) {
        return;
      }

      // Create notifications for all recipients
      const notifications = [];
      for (const recipientId of recipients) {
        const notification = await this.createNotification(
          recipientId,
          "project_status",
          `${changedByUser.fullName} changed ${project.name} status to ${newStatus}`,
          projectId
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error("Error notifying project status change:", error);
    }
  }
}

export const notificationService = new NotificationService();
