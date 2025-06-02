import { io } from 'socket.io-client';

// Create a socket connection with better error handling and persistence
export const createSocketConnection = (sessionId, role, name, debugLog) => {
  if (!sessionId || !role) {
    throw new Error('Session ID and role are required');
  }

  // For Vercel deployment, we use the same domain with the API path
  const socketUrl = window.location.origin;
  const socketPath = '/api/socket';
  
  // Always log connection details for debugging
  debugLog?.(`Creating socket connection to ${socketUrl}`);
  debugLog?.(`Socket path: ${socketPath}`);
  debugLog?.(`Session ID: ${sessionId}, Role: ${role}`);

  // Create socket with optimized configuration for Vercel serverless functions
  const socket = io(socketUrl, {
    query: { sessionId, role, name },
    path: socketPath,
    // Aggressive reconnection configuration
    reconnectionAttempts: 15,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 30000,
    // Polling only - WebSockets not supported in Vercel serverless
    transports: ['polling'],
    upgrade: false,
    forceNew: true,
    withCredentials: true,
    // Add Vercel proxy headers
    extraHeaders: {
      "X-Forwarded-Proto": window.location.protocol.slice(0, -1),
      "X-Forwarded-Host": window.location.host,
    },
    autoConnect: true,
  });

  // Add connection event handlers with better error reporting
  socket.on('connect', () => {
    debugLog?.('Socket.IO connection successful!');
    debugLog?.(`Connected to ${socketUrl} with path ${socketPath}`);
  });
  
  socket.on('connect_error', (error) => {
    debugLog?.(`Socket.IO connection error: ${error.message}`);
    debugLog?.(`Error details: ${error.message}`);
    debugLog?.(`Failed to connect to ${socketUrl} with path ${socketPath}`);
    
    // Log transport information for debugging
    debugLog?.(`Current transport: ${socket.io.engine?.transport?.name}`);
    debugLog?.(`Transport options: ${socket.io.opts.transports.join(', ')}`);
    
    // Log additional connection details for debugging
    debugLog?.(`Connection query params: ${JSON.stringify(socket.io.opts.query)}`);
    debugLog?.(`Extra headers: ${JSON.stringify(socket.io.opts.extraHeaders)}`);
  });
  
  // Add special handling for reconnection attempts
  socket.io.on("reconnect_attempt", (attempt) => {
    debugLog?.(`Socket reconnection attempt ${attempt}...`);
  });

  socket.io.on("reconnect", (attempt) => {
    debugLog?.(`Socket reconnected after ${attempt} attempts`);
  });

  socket.io.on("reconnect_error", (error) => {
    debugLog?.(`Socket reconnection error: ${error.message}`);
  });

  socket.io.on("reconnect_failed", () => {
    debugLog?.('Socket reconnection failed after all attempts');
  });

  return socket;
}; 