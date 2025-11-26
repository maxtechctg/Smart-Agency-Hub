/**
 * Centralized WebSocket URL construction for consistent connections
 * across the application (chat, notifications, etc.)
 */

export function getWebSocketUrl(): string {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("No authentication token found");
  }

  // Use window.location.origin and swap http/https protocol to ws/wss
  // This works correctly in both development and production environments
  const origin = window.location.origin;
  const wsOrigin = origin.replace(/^http/, 'ws');
  
  // Construct WebSocket URL with authentication token
  const wsUrl = `${wsOrigin}/ws?token=${encodeURIComponent(token)}`;
  
  // Log connection attempt without exposing the token
  console.log(`WebSocket: Connecting to ${wsOrigin}/ws`);
  return wsUrl;
}
