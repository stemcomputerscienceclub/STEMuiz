import { io } from 'socket.io-client';

// Create a socket connection with better error handling and persistence
export const createSocketConnection = (sessionId, role, name, debugLog) => {
  if (!sessionId || !role) {
    throw new Error('Session ID and role are required');
  }

  // Handle both production and development environments
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Updated default URL configuration
  // For production, use /socket.io path on the same domain by default
  const defaultUrl = isProduction ? 
    window.location.origin : // Use current domain in production
    'http://localhost:3001';  // Use explicit URL in development
  
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || defaultUrl;
  debugLog?.(`Creating socket connection to ${socketUrl}`);
  
  // Add more detailed debug logging
  console.log(`Attempting Socket.IO connection to: ${socketUrl}`);
  console.log(`Session ID: ${sessionId}, Role: ${role}`);

  // Create socket with improved reconnection options
  const socket = io(socketUrl, {
    query: { sessionId, role, name },
    path: isProduction ? '/socket.io' : undefined, // Add explicit path in production
    transports: ['polling', 'websocket'], // Try polling first, then websocket
    reconnection: true,
    reconnectionAttempts: 10,       // Increased attempts
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,     // Cap the delay
    timeout: 20000,
    forceNew: true,                 // Force a new connection for reliability
    multiplex: true,                // Enable multiplexing
    autoConnect: true,
    withCredentials: true,          // Allow credentials in cross-domain requests
    extraHeaders: {                 // Help with CORS issues
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,PUT,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Content-Length, X-Requested-With"
    }
  });

  // Add connection event handlers
  socket.on('connect', () => {
    console.log('Socket.IO connection successful!');
    debugLog?.(`Socket successfully connected to ${socketUrl}`);
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