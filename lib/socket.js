import { io } from 'socket.io-client';

// Create a socket connection with better error handling and persistence
export const createSocketConnection = (sessionId, role, name, debugLog) => {
  if (!sessionId || !role) {
    throw new Error('Session ID and role are required');
  }

  // Handle both production and development environments
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Critical fix: Use correct Socket.IO path
  // Production should use socket.io path on current domain
  const defaultUrl = isProduction ? 
    window.location.origin : // Use current domain in production
    'http://localhost:3001';  // Use explicit URL in development
  
  debugLog?.(`Creating socket connection to ${defaultUrl}`);
  console.log(`Attempting Socket.IO connection to: ${defaultUrl}`);
  console.log(`Session ID: ${sessionId}, Role: ${role}`);

  // Create socket with improved configuration
  const socket = io(defaultUrl, {
    query: { sessionId, role, name },
    // Critical fix: ALWAYS use /socket.io path - this is the default Socket.IO path
    path: '/socket.io',
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
    debugLog?.(`Socket successfully connected to ${defaultUrl}`);
  });
  
  socket.on('connect_error', (error) => {
    console.error('Socket.IO connection error:', error);
    console.error('Error details:', error.message);
    debugLog?.(`Socket connection error: ${error.message}`);
    
    // Try falling back to polling if websocket fails
    if (socket.io.opts.transports.indexOf('polling') < 0) {
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
    debugLog?.(`Socket reconnection error: ${error}`);
  });

  return socket;
}; 