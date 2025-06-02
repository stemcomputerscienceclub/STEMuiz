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

  // Create socket with improved configuration for Vercel Edge Functions
  const socket = io(socketUrl, {
    query: { sessionId, role, name },
    path: socketPath,
    transports: ['polling'], // Only use polling for Vercel
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    timeout: 30000,
    forceNew: true,
    autoConnect: true,
    upgrade: false,
    // Add Vercel-specific configuration
    extraHeaders: {
      'X-Forwarded-Proto': 'https',
      'X-Forwarded-Host': window.location.host
    },
    // Disable WebSocket transport
    'transports': ['polling']
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
    
    // Try falling back to polling if websocket fails
    if (socket.io.opts.transports[0] === 'websocket') {
      debugLog?.('Falling back to polling transport');
      socket.io.opts.transports = ['polling', 'websocket'];
    }
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