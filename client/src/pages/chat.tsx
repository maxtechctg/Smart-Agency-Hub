import { useState, useEffect, useRef } from "react";
import { Send, AlertCircle, Paperclip, FileText, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getWebSocketUrl } from "@/lib/websocket";
import { useToast } from "@/hooks/use-toast";
import { type Message, type Project } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";

export default function Chat() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [message, setMessage] = useState("");
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting");
  const [wsError, setWsError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const selectedProjectRef = useRef<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Keep selectedProjectRef in sync with selectedProject
  useEffect(() => {
    selectedProjectRef.current = selectedProject;
  }, [selectedProject]);

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });
  
  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages", selectedProject],
    queryFn: async () => {
      if (!selectedProject) return [];
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      // Append projectId as query parameter for client users
      const url = `/api/messages?projectId=${selectedProject}`;
      const res = await fetch(url, { headers, credentials: "include" });
      
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          window.location.href = "/login";
        }
        const errorData = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(errorData.error || `Request failed with status ${res.status}`);
      }
      
      return res.json();
    },
    enabled: !!selectedProject,
  });

  const sendMessageMutation = useMutation({
    mutationFn: (data: { projectId: string; content: string }) =>
      apiRequest("POST", "/api/messages", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedProject] });
      setMessage("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", selectedProject);

      const token = localStorage.getItem("token");
      const response = await fetch("/api/messages/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "File upload failed");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedProject] });
      toast({ title: "Success", description: "File uploaded successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // WebSocket connection - independent of project selection
  useEffect(() => {
    let wsUrl: string;
    try {
      wsUrl = getWebSocketUrl();
    } catch (error: any) {
      setWsStatus("error");
      setWsError(error.message || "Failed to initialize WebSocket connection");
      return;
    }
    
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 3000;
    let authFailure = false;

    const connect = () => {
      if (authFailure) {
        console.log("Chat: Not reconnecting due to authentication failure");
        return;
      }

      console.log("Chat: Connecting to WebSocket");
      setWsStatus("connecting");
      setWsError(null);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
        setWsStatus("connected");
        setWsError(null);
        reconnectAttempts = 0;
        
        // Subscribe to current project if one is selected (use ref to get latest value)
        const currentProject = selectedProjectRef.current;
        if (currentProject) {
          ws.send(JSON.stringify({
            type: "subscribe",
            projectId: currentProject
          }));
          console.log(`Auto-subscribed to project on (re)connect: ${currentProject}`);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "new_message") {
            // Invalidate messages query to refetch with new message
            queryClient.invalidateQueries({ queryKey: ["/api/messages", data.projectId] });
          } else if (data.type === "connected") {
            console.log("WebSocket authentication successful");
            setWsStatus("connected");
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setWsStatus("error");
      };

      ws.onclose = (event) => {
        console.log("WebSocket disconnected", event.code, event.reason);
        setWsStatus("disconnected");
        
        // Check if close was due to authentication failure (code 1008)
        if (event.code === 1008 || event.reason?.includes("Authentication")) {
          authFailure = true;
          setWsError("Authentication failed. Your session may have expired. Please log in again.");
          setWsStatus("error");
          
          toast({
            title: "Authentication Error",
            description: "Your session has expired. Please log in again.",
            variant: "destructive",
          });
          
          // Auto-logout after 3 seconds
          setTimeout(() => {
            logout();
          }, 3000);
          return;
        }
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts < maxReconnectAttempts && !authFailure) {
          reconnectAttempts++;
          console.log(`Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
          setTimeout(() => {
            connect();
          }, reconnectDelay * reconnectAttempts);
        } else if (!authFailure) {
          console.error("Max reconnection attempts reached");
          setWsError("Failed to connect to chat server after multiple attempts.");
          setWsStatus("error");
        }
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        // Prevent reconnection on intentional close
        wsRef.current.onclose = null;
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close();
        }
      }
    };
  }, []); // Only connect once on mount

  // Subscribe to project when selected (after connection is established)
  useEffect(() => {
    if (!selectedProject || !wsRef.current) return;

    const ws = wsRef.current;

    const subscribe = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "subscribe",
          projectId: selectedProject
        }));
        console.log(`Subscribed to project: ${selectedProject}`);
      }
    };

    // If already open, subscribe immediately
    if (ws.readyState === WebSocket.OPEN) {
      subscribe();
    } else if (ws.readyState === WebSocket.CONNECTING) {
      // Wait for connection to open
      const handleOpen = () => {
        subscribe();
        ws.removeEventListener("open", handleOpen);
      };
      ws.addEventListener("open", handleOpen);
    }

    // Cleanup: unsubscribe when project changes or component unmounts
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "unsubscribe",
          projectId: selectedProject
        }));
        console.log(`Unsubscribed from project: ${selectedProject}`);
      }
    };
  }, [selectedProject]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || !selectedProject) return;
    sendMessageMutation.mutate({ projectId: selectedProject, content: message });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedProject) {
      toast({
        title: "Error",
        description: "Please select a project first",
        variant: "destructive",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "Error",
        description: "File size exceeds 10MB limit",
        variant: "destructive",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    uploadFileMutation.mutate(file);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Team Chat</h1>
        <p className="text-sm text-muted-foreground">Project-wise communication</p>
      </div>

      {wsStatus === "error" && wsError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>{wsError}</AlertDescription>
        </Alert>
      )}

      {wsStatus === "connecting" && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connecting...</AlertTitle>
          <AlertDescription>Establishing connection to chat server...</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Project</CardTitle>
        </CardHeader>
        <CardContent>
          <Select onValueChange={setSelectedProject} value={selectedProject}>
            <SelectTrigger data-testid="select-project">
              <SelectValue placeholder="Choose a project to view messages" />
            </SelectTrigger>
            <SelectContent>
              {projects?.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedProject && (
        <Card className="flex flex-col h-[600px]">
          <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-sm text-muted-foreground">Loading messages...</div>
              </div>
            ) : !messages || messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
                  <p className="text-sm text-muted-foreground">Start the conversation</p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.userId === user?.id ? "flex-row-reverse" : ""}`}
                    data-testid={`message-${msg.id}`}
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs">U</AvatarFallback>
                    </Avatar>
                    <div className={`flex flex-col ${msg.userId === user?.id ? "items-end" : ""}`}>
                      <div
                        className={`rounded-lg p-3 max-w-md ${
                          msg.userId === user?.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {msg.content && <p className="text-sm">{msg.content}</p>}
                        {msg.fileUrl && msg.fileType?.startsWith("image/") && (
                          <img
                            src={msg.fileUrl}
                            alt={msg.fileName || "Image"}
                            className="max-w-full rounded-md mt-2"
                            data-testid={`image-${msg.id}`}
                          />
                        )}
                        {msg.fileUrl && !msg.fileType?.startsWith("image/") && (
                          <a
                            href={msg.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm hover:underline"
                            data-testid={`file-link-${msg.id}`}
                          >
                            <FileText className="w-4 h-4" />
                            <span>{msg.fileName || "Download file"}</span>
                          </a>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground mt-1">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </CardContent>
          <CardContent className="border-t p-4">
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt"
                data-testid="input-file"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleAttachmentClick}
                disabled={!selectedProject || uploadFileMutation.isPending}
                data-testid="button-attach"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <Input
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSend()}
                disabled={sendMessageMutation.isPending}
                data-testid="input-message"
              />
              <Button onClick={handleSend} disabled={sendMessageMutation.isPending} data-testid="button-send">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
