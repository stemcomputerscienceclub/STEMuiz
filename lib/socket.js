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
  console.log(`Creating socket connection to ${socketUrl}`);
  console.log(`Socket path: ${socketPath}`);
  console.log(`Session ID: ${sessionId}, Role: ${role}`);

  // Create socket with improved configuration
  const socket = io(socketUrl, {
    query: { sessionId, role, name },
    path: socketPath,
    // Try both transport methods
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    forceNew: true,
    autoConnect: true
  });

  // Add connection event handlers
  socket.on('connect', () => {
    console.log('Socket.IO connection successful!');
    console.log(`Connected to ${socketUrl} with path ${socketPath}`);
    debugLog?.(`Socket successfully connected to ${socketUrl}`);
  });
  
  socket.on('connect_error', (error) => {
    console.error('Socket.IO connection error:', error);
    console.error('Error details:', error.message);
    console.error(`Failed to connect to ${socketUrl} with path ${socketPath}`);
    debugLog?.(`Socket connection error: ${error.message}`);
    
    // Try falling back to polling if websocket fails
    if (socket.io.opts.transports.indexOf('polling') < 0) {
      console.log('Falling back to polling transport');
      debugLog?.('Falling back to polling transport');
      socket.io.opts.transports = ['polling', 'websocket'];
    }
  });
  
  // Add special handling for reconnection attempts
  socket.io.on("reconnect_attempt", (attempt) => {
    console.log(`Socket reconnection attempt ${attempt}...`);
    debugLog?.(`Socket reconnection attempt ${attempt}...`);
  });

  socket.io.on("reconnect", (attempt) => {
    console.log(`Socket reconnected after ${attempt} attempts`);
    debugLog?.(`Socket reconnected after ${attempt} attempts`);
  });

  socket.io.on("reconnect_error", (error) => {
    console.error(`Socket reconnection error: ${error}`);
    debugLog?.(`Socket reconnection error: ${error}`);
  });

  return socket;
}; 