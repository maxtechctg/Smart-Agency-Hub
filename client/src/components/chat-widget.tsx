import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X, Send, AlertCircle, Paperclip, FileText, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

// Enriched message type with client/project info
interface EnrichedMessage {
  id: string;
  projectId: string;
  userId: string;
  content: string | null;
  createdAt: Date;
  projectName: string | null;
  clientId: string | null;
  clientName: string | null;
  senderName: string | null;
  senderRole: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
}

export default function ChatWidget() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  // CRITICAL: selectedConversation must NEVER be reset after sending
  // It determines which conversation the user is replying to
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting");
  const [wsError, setWsError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // UNIFIED INBOX: Fetch all messages from all projects (for developers/admins)
  const { data: messages, isLoading, refetch } = useQuery<EnrichedMessage[]>({
    queryKey: ["/api/messages"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      // No projectId filter - get all messages (unified inbox)
      const url = `/api/messages`;
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
    enabled: isOpen, // Only fetch when widget is open
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 0, // Always refetch to show latest messages
  });

  const sendMessageMutation = useMutation({
    mutationFn: (data: { projectId: string; content: string }) => {
      console.log("🔵 MUTATION: Sending message", { projectId: data.projectId, content: data.content });
      if (!data.projectId) {
        throw new Error("No project selected. Please select a conversation first.");
      }
      return apiRequest("POST", "/api/messages", data);
    },
    onSuccess: async (response) => {
      console.log("✅ MUTATION SUCCESS: Message sent", response);
      console.log("🔒 KEEPING selectedConversation:", selectedConversation);
      
      // Clear message input ONLY on successful send
      setMessage("");
      
      // CRITICAL: Do NOT reset selectedConversation here
      // Keep it so the reply indicator stays active
      
      // Force refetch messages to show new message immediately
      console.log("🔄 REFETCH: Calling refetch after mutation success");
      const result = await refetch();
      console.log("✅ REFETCH COMPLETE:", result.data?.length, "messages");
      console.log("🎯 selectedConversation AFTER refetch:", selectedConversation);
    },
    onError: (error: Error) => {
      console.error("❌ MUTATION ERROR:", error);
      toast({ 
        title: "Failed to send message", 
        description: error.message, 
        variant: "destructive" 
      });
      // Don't clear message on error - keep it so user can retry
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (data: { projectId: string; file: File; content?: string }) => {
      const formData = new FormData();
      formData.append("file", data.file);
      formData.append("projectId", data.projectId);
      if (data.content) {
        formData.append("content", data.content);
      }

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
    onSuccess: async () => {
      setMessage("");
      setSelectedFile(null);
      toast({ title: "Success", description: "File uploaded successfully" });
      await refetch();
    },
    onError: (error: Error) => {
      toast({ title: "File upload failed", description: error.message, variant: "destructive" });
      setSelectedFile(null);
    },
  });

  // WebSocket connection - only when widget is open
  useEffect(() => {
    if (!isOpen) return;

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
        console.log("ChatWidget: Not reconnecting due to authentication failure");
        return;
      }

      console.log("ChatWidget: Connecting to WebSocket");
      setWsStatus("connecting");
      setWsError(null);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("ChatWidget: WebSocket connected - auto-subscribed to all projects");
        setWsStatus("connected");
        setWsError(null);
        reconnectAttempts = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("📨 WEBSOCKET MESSAGE:", data);
          
          if (data.type === "new_message") {
            console.log("🔔 NEW MESSAGE via WebSocket:", data.message);
            console.log("🔄 REFETCH: Calling refetch after WebSocket message");
            // Force refetch to show new message immediately
            refetch().then(result => {
              console.log("✅ REFETCH COMPLETE after WebSocket:", result.data?.length, "messages");
            });
          } else if (data.type === "connected") {
            console.log("ChatWidget: WebSocket authentication successful");
            setWsStatus("connected");
          } else if (data.type === "subscribed_all") {
            console.log(`ChatWidget: Auto-subscribed to ${data.projectCount} projects`);
          }
        } catch (error) {
          console.error("ChatWidget: Error parsing WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("ChatWidget: WebSocket error:", error);
        setWsStatus("error");
      };

      ws.onclose = (event) => {
        console.log("ChatWidget: WebSocket disconnected", event.code, event.reason);
        setWsStatus("disconnected");
        
        // Check if close was due to authentication failure
        if (event.code === 1008 || event.reason?.includes("Authentication")) {
          authFailure = true;
          setWsError("Authentication failed. Your session may have expired. Please log in again.");
          setWsStatus("error");
          
          toast({
            title: "Authentication Error",
            description: "Your session has expired. Please log in again.",
            variant: "destructive",
          });
          
          setTimeout(() => {
            logout();
          }, 3000);
          return;
        }
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts < maxReconnectAttempts && !authFailure) {
          reconnectAttempts++;
          console.log(`ChatWidget: Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
          setTimeout(() => {
            connect();
          }, reconnectDelay * reconnectAttempts);
        } else if (!authFailure) {
          console.error("ChatWidget: Max reconnection attempts reached");
          setWsError("Failed to connect to chat server after multiple attempts.");
          setWsStatus("error");
        }
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close();
        }
      }
    };
  }, [isOpen, logout, toast, refetch]);

  // Auto-scroll to BOTTOM when messages change (WhatsApp/Messenger behavior)
  useEffect(() => {
    // Only scroll if widget is open and messages exist
    if (!isOpen || !messages || messages.length === 0) {
      return;
    }
    
    // Delay scroll slightly to ensure DOM has updated
    const scrollToBottom = () => {
      if (messagesContainerRef.current) {
        console.log("📜 AUTO-SCROLL: Scrolling to BOTTOM (newest message) for", messages.length, "messages");
        // Scroll to BOTTOM - newest messages appear at bottom (ASC order)
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      } else {
        console.warn("⚠️ AUTO-SCROLL: Container ref not found");
      }
    };
    
    // Use setTimeout to ensure DOM has rendered the new messages
    const timeoutId = setTimeout(scrollToBottom, 100);
    
    return () => clearTimeout(timeoutId);
  }, [messages, isOpen]);

  // Auto-select first conversation when messages load - ONLY if not already selected
  useEffect(() => {
    console.log("📊 MESSAGES UPDATED:", messages?.length || 0, "messages");
    console.log("🎯 SELECTED CONVERSATION:", selectedConversation);
    
    // CRITICAL: Only auto-select if NO conversation is currently selected
    // This prevents resetting selectedConversation after sending a message
    if (messages && messages.length > 0 && !selectedConversation) {
      const latestMessage = messages[0];
      console.log("🔹 AUTO-SELECT: Selecting first conversation", latestMessage?.projectId);
      if (latestMessage?.projectId) {
        setSelectedConversation(latestMessage.projectId);
      }
    }
  }, [messages]); // REMOVED selectedConversation from deps to prevent resets

  const handleSend = async () => {
    console.log("🚀 HANDLE SEND: Called", { 
      message: message.trim(), 
      selectedFile: selectedFile?.name,
      selectedConversation,
      messageLength: message.trim().length 
    });
    
    if (!selectedConversation) {
      console.error("❌ NO CONVERSATION SELECTED");
      toast({ 
        title: "No conversation selected", 
        description: "Please select a conversation by clicking on a message first.",
        variant: "destructive" 
      });
      return;
    }

    // File upload
    if (selectedFile) {
      uploadFileMutation.mutate({
        projectId: selectedConversation,
        file: selectedFile,
        content: message.trim() || undefined,
      });
      return;
    }
    
    // Text message
    if (!message.trim()) {
      toast({ 
        title: "Empty message", 
        description: "Please type a message before sending.",
        variant: "destructive" 
      });
      return;
    }
    
    console.log("📤 SENDING MESSAGE:", { projectId: selectedConversation, content: message.trim() });
    sendMessageMutation.mutate({ 
      projectId: selectedConversation, 
      content: message.trim() 
    });
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Only images and documents (PDF, Word, TXT) are allowed",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }

    if (!selectedConversation) {
      toast({
        title: "No conversation selected",
        description: "Please select a conversation first",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    e.target.value = "";
  };

  // Don't render widget if not authenticated
  if (!user) {
    return null;
  }

  const widgetContent = (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          data-testid="button-open-chat"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat Popup Window */}
      {isOpen && (
        <>
          {/* Invisible backdrop to block click-through */}
          <div 
            className="fixed inset-0"
            style={{ 
              zIndex: 999998,
              backgroundColor: 'transparent',
              pointerEvents: 'auto'
            }}
            onClick={() => setIsOpen(false)}
          />
          
          {/* Chat popup container */}
          <div 
            className="fixed w-96 h-[600px] shadow-2xl rounded-lg flex flex-col bg-card border"
            style={{ 
              bottom: '24px', 
              right: '24px', 
              zIndex: 999999,
              pointerEvents: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 p-4 border-b">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <h2 className="font-semibold">Team Chat</h2>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsOpen(false)}
              data-testid="button-close-chat"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Connection Status */}
            {wsStatus === "error" && wsError && (
              <Alert variant="destructive" className="m-4 mb-0">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Connection Error</AlertTitle>
                <AlertDescription className="text-xs">{wsError}</AlertDescription>
              </Alert>
            )}

            {wsStatus === "connecting" && (
              <Alert className="m-4 mb-0">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Connecting...</AlertTitle>
                <AlertDescription className="text-xs">Establishing connection...</AlertDescription>
              </Alert>
            )}

            {/* UNIFIED INBOX - Messages from all projects */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">Loading messages...</p>
                </div>
              ) : !messages || messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-sm font-medium mb-1">No messages yet</p>
                    <p className="text-xs text-muted-foreground">Waiting for conversations...</p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg) => {
                    const isBuyer = msg.senderRole === "client";
                    const isMyMessage = msg.userId === user?.id;
                    console.log("💬 RENDERING MESSAGE:", { 
                      id: msg.id, 
                      projectId: msg.projectId, 
                      content: msg.content?.substring(0, 30) || "(file)",
                      senderName: msg.senderName,
                      isMyMessage 
                    });
                    
                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-2 ${isMyMessage ? "flex-row-reverse" : ""} cursor-pointer hover-elevate rounded-lg p-2`}
                        data-testid={`message-${msg.id}`}
                        onClick={() => {
                          console.log("🎯 CONVERSATION SELECTED:", msg.projectId);
                          setSelectedConversation(msg.projectId);
                        }}
                      >
                        <Avatar className="w-7 h-7">
                          <AvatarFallback className="text-xs">
                            {msg.senderName?.charAt(0)?.toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`flex flex-col flex-1 ${isMyMessage ? "items-end" : ""}`}>
                          {/* Project Tag Above Message */}
                          <div className={`mb-1 ${isMyMessage ? "text-right" : ""}`}>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                              {msg.projectName || "Unknown Project"}
                            </Badge>
                          </div>
                          
                          {/* Message Content with Buyer Name and Files */}
                          <div
                            className={`rounded-lg p-2 max-w-[250px] ${
                              isMyMessage
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            {isBuyer && !isMyMessage && (
                              <p className="text-xs font-semibold mb-0.5">
                                {msg.clientName || msg.senderName}:
                              </p>
                            )}
                            {msg.content && <p className="text-xs break-words">{msg.content}</p>}
                            {msg.fileUrl && msg.fileType?.startsWith("image/") && (
                              <img
                                src={msg.fileUrl}
                                alt={msg.fileName || "Image"}
                                className="max-w-full rounded-md mt-1"
                                data-testid={`image-${msg.id}`}
                              />
                            )}
                            {msg.fileUrl && !msg.fileType?.startsWith("image/") && (
                              <a
                                href={msg.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs hover:underline mt-1"
                                data-testid={`file-link-${msg.id}`}
                              >
                                <FileText className="w-3 h-3" />
                                <span className="truncate">{msg.fileName || "Download file"}</span>
                              </a>
                            )}
                          </div>
                          
                          {/* Timestamp */}
                          <div className="flex items-center gap-1 mt-0.5">
                            {!isBuyer && (
                              <>
                                <span className="text-[10px] text-muted-foreground">
                                  {msg.senderName}
                                </span>
                                <span className="text-[10px] text-muted-foreground">•</span>
                              </>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(msg.createdAt).toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area - Shows when conversation is selected */}
            <div className="p-4 border-t">
              {selectedConversation ? (
                <>
                  <div className="text-[10px] text-muted-foreground mb-2">
                    Replying to: <span className="font-semibold">
                      {messages?.find(m => m.projectId === selectedConversation)?.projectName}
                      {" "}
                      ({messages?.find(m => m.projectId === selectedConversation)?.clientName})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {selectedFile && (
                      <div className="text-xs text-muted-foreground bg-muted p-2 rounded-md flex items-center gap-2">
                        <FileText className="w-3 h-3" />
                        <span className="flex-1 truncate">{selectedFile.name}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          onClick={() => setSelectedFile(null)}
                          data-testid="button-remove-file"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSend();
                      }}
                      className="flex gap-2"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileSelect}
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx,.txt"
                        data-testid="input-file-widget"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleAttachmentClick}
                        disabled={!selectedConversation || uploadFileMutation.isPending}
                        data-testid="button-attach-widget"
                        className="flex-shrink-0"
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Input
                        placeholder="Type your reply..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        disabled={sendMessageMutation.isPending || uploadFileMutation.isPending}
                        data-testid="input-message-widget"
                        className="flex-1 text-sm"
                      />
                      <Button
                        type="submit"
                        size="icon"
                        disabled={((!message.trim() && !selectedFile) || sendMessageMutation.isPending || uploadFileMutation.isPending)}
                        data-testid="button-send-widget"
                        className="flex-shrink-0"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Click on a message to select a conversation and reply</p>
                </div>
              )}
            </div>
          </div>
        </div>
        </>
      )}
    </>
  );

  // Render to document.body using Portal to ensure viewport-level positioning
  return createPortal(widgetContent, document.body);
}
