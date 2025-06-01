import { io } from 'socket.io-client';

// Create a socket connection with better error handling and persistence
export const createSocketConnection = (sessionId, role, name, debugLog) => {
  if (!sessionId || !role) {
    throw new Error('Session ID and role are required');
  }

  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
  debugLog?.(`Creating socket connection to ${socketUrl}`);

  // Create socket with improved reconnection options
  const socket = io(socketUrl, {
    query: { sessionId, role, name },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,       // Increased attempts
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,     // Cap the delay
    timeout: 20000,
    forceNew: false,                // Reuse existing connection if possible
    multiplex: true,                // Enable multiplexing
    autoConnect: true
  });

  // Add special handling for reconnection attempts
  socket.io.on("reconnect_attempt", (attempt) => {
    debugLog?.(`Socket reconnection attempt ${attempt}...`);
  });

  socket.io.on("reconnect", (attempt) => {
    debugLog?.(`Socket reconnected after ${attempt} attempts`);
  });

  socket.io.on("reconnect_error", (error) => {
    debugLog?.(`Socket reconnection error: ${error}`);
  });

  return socket;
}; 