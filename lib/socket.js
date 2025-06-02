import { io } from 'socket.io-client';

// Create a socket connection with better error handling and persistence
export const createSocketConnection = (sessionId, role, name, debugLog) => {
  if (!sessionId || !role) {
    throw new Error('Session ID and role are required');
  }
  
  if (!name && role === 'player') {
    throw new Error('Player name is required when role is player');
  }

  // Use environment variable if available, fallback to window.location.origin
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin;
  const socketPath = '/api/socket';
  
  // Always log connection details for debugging
  debugLog?.(`Creating socket connection to ${socketUrl}`);
  debugLog?.(`Socket path: ${socketPath}`);
  debugLog?.(`Session ID: ${sessionId}, Role: ${role}, Name: ${name || 'N/A'}`);

  // Create socket with optimized configuration for Vercel serverless functions
  const socket = io(socketUrl, {
    query: { 
      sessionId, 
      role, 
      name: name || undefined,  // Only include name if it has a value
      timestamp: Date.now()     // Add timestamp to prevent caching issues
    },
    path: socketPath,
    // Aggressive but reasonable reconnection configuration
    reconnectionAttempts: 5,    // Reduced to prevent excessive attempts
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000, // Reduced to speed up reconnection cycles
    timeout: 20000,             // Reduced timeout for faster failure detection
    // Polling only - WebSockets not supported in Vercel serverless
    transports: ['polling'],
    upgrade: false,
    forceNew: true,
    withCredentials: true,
    // Add Vercel proxy headers when in browser environment
    extraHeaders: typeof window !== 'undefined' ? {
      "X-Forwarded-Proto": window.location.protocol.slice(0, -1),
      "X-Forwarded-Host": window.location.host,
    } : {},
    autoConnect: true,
  });

  // Add connection event handlers with better error reporting
  socket.on('connect', () => {
    debugLog?.('Socket.IO connection successful!');
    debugLog?.(`Socket ID: ${socket.id}`);
    debugLog?.(`Connected to ${socketUrl} with path ${socketPath}`);
  });
  
  socket.on('connect_error', (error) => {
    debugLog?.(`Socket.IO connection error: ${error.message}`);
    debugLog?.(`Error details: ${JSON.stringify(error)}`);
    debugLog?.(`Failed to connect to ${socketUrl} with path ${socketPath}`);
    
    // Log transport information for debugging
    debugLog?.(`Current transport: ${socket.io.engine?.transport?.name}`);
    debugLog?.(`Transport options: ${socket.io.opts.transports.join(', ')}`);
    
    // Log additional connection details for debugging
    debugLog?.(`Connection query params: ${JSON.stringify(socket.io.opts.query)}`);
    
    // Provide guidance on potential fixes
    if (error.message.includes('xhr poll error')) {
      debugLog?.('This may be a CORS or network issue. Check server CORS configuration.');
    } else if (error.message.includes('Invalid namespace')) {
      debugLog?.('The server may not have the namespace configured correctly.');
    } else if (error.message.includes('timeout')) {
      debugLog?.('Connection timed out. The server may be down or unreachable.');
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
    debugLog?.('Please refresh the page or check your network connection');
  });
  
  // Add event handlers for specific game events
  socket.on('error', (errorData) => {
    debugLog?.(`Server error: ${typeof errorData === 'string' ? errorData : JSON.stringify(errorData)}`);
  });

  return socket;
};