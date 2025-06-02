// Socket.IO Client Test Script
require('dotenv').config();
const { io } = require('socket.io-client');
const { v4: uuidv4 } = require('uuid');

// Configuration
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';
const SOCKET_PATH = '/api/socket';
const TEST_SESSION_ID = process.env.TEST_SESSION_ID || uuidv4(); // Generate random session ID if not provided
const TEST_PLAYER_NAME = 'TestPlayer';

// Test different roles
const roles = ['host', 'player'];
let currentRoleIndex = 0;

// Create a socket connection
const connectSocket = (role) => {
  console.log(`\n----- Testing ${role.toUpperCase()} Connection -----`);
  console.log(`Connecting to: ${SOCKET_URL}`);
  console.log(`Socket path: ${SOCKET_PATH}`);
  console.log(`Session ID: ${TEST_SESSION_ID}`);
  console.log(`Role: ${role}`);
  
  if (role === 'player') {
    console.log(`Player name: ${TEST_PLAYER_NAME}`);
  }
  
  // Create socket with debugging configuration
  const socket = io(SOCKET_URL, {
    path: SOCKET_PATH,
    query: { 
      sessionId: TEST_SESSION_ID, 
      role: role,
      name: role === 'player' ? TEST_PLAYER_NAME : undefined,
      timestamp: Date.now() // Add timestamp to prevent caching issues
    },
    reconnectionAttempts: 3,
    reconnectionDelay: 1000,
    timeout: 20000, // Increased timeout for serverless functions
    transports: ['polling'],
    upgrade: false, // Disable WebSocket upgrade
    forceNew: true,
    withCredentials: true,
    autoConnect: true,
    extraHeaders: {
      "X-Test-Header": "true"
    }
  });

  // Connection events
  socket.on('connect', () => {
    console.log('✅ Connected successfully!');
    console.log(`Socket ID: ${socket.id}`);
    
    // For host role, test creating a game session
    if (role === 'host') {
      console.log('Testing host functionality: Creating test game session...');
      socket.emit('host:create-session', { 
        sessionId: TEST_SESSION_ID,
        gameTitle: 'Test Game',
        questions: [
          { question: 'Test Question 1', answers: ['A', 'B', 'C', 'D'], correctAnswer: 0 },
          { question: 'Test Question 2', answers: ['A', 'B', 'C', 'D'], correctAnswer: 1 },
        ]
      });
    }
    // For player role, test joining a game session
    else if (role === 'player') {
      console.log('Testing player functionality: Joining test game session...');
      socket.emit('player:join', { 
        sessionId: TEST_SESSION_ID,
        playerName: TEST_PLAYER_NAME
      });
    }
  });

  socket.on('connect_error', (err) => {
    console.error('❌ Connection error:', err.message);
    console.error('Error details:', err);
    
    // Log transport and connection details
    if (socket.io) {
      console.log(`Current transport: ${socket.io.engine?.transport?.name || 'unknown'}`);
      console.log(`Transport options: ${socket.io.opts.transports.join(', ')}`);
      console.log('Connection options:', JSON.stringify(socket.io.opts));
    }
    
    // Provide helpful debug information based on error
    if (err.message.includes('xhr poll error')) {
      console.log('This appears to be a CORS or network issue:');
      console.log('1. Check that your server is running');
      console.log('2. Verify CORS settings on the server');
      console.log('3. Check network connectivity');
    } else if (err.message.includes('timeout')) {
      console.log('Connection timed out:');
      console.log('1. The server may be down or unresponsive');
      console.log('2. Check firewall settings');
      console.log('3. Try increasing the timeout value');
    }
  });

  socket.io.on('reconnect_attempt', (attempt) => {
    console.log(`🔄 Reconnection attempt ${attempt}...`);
  });

  socket.io.on('reconnect_failed', () => {
    console.log('❌ Failed to reconnect after all attempts');
    testNextRole();
  });

  // Game event responses
  socket.on('host:session-created', (data) => {
    console.log('✅ Host session created successfully:', data);
    setTimeout(() => {
      console.log('Disconnecting host...');
      socket.disconnect();
      testNextRole();
    }, 2000);
  });

  socket.on('player:joined', (data) => {
    console.log('✅ Player joined successfully:', data);
    setTimeout(() => {
      console.log('Disconnecting player...');
      socket.disconnect();
      console.log('\n✅ All tests completed!');
      process.exit(0);
    }, 2000);
  });

  // Error events
  socket.on('error', (error) => {
    console.error('❌ Server error:', typeof error === 'string' ? error : JSON.stringify(error));
  });

  // Catch custom error events
  socket.on('host:error', (error) => {
    console.error('❌ Host error:', typeof error === 'string' ? error : JSON.stringify(error));
  });

  socket.on('player:error', (error) => {
    console.error('❌ Player error:', typeof error === 'string' ? error : JSON.stringify(error));
  });

  // Add event handlers for all possible game events for better testing
  socket.on('game:state', (state) => {
    console.log('Received game state:', state);
  });
  
  socket.on('leaderboard:update', (leaderboard) => {
    console.log('Received leaderboard update:', leaderboard);
  });
  
  return socket;
};

// Test next role in sequence
function testNextRole() {
  currentRoleIndex++;
  if (currentRoleIndex < roles.length) {
    const nextRole = roles[currentRoleIndex];
    setTimeout(() => connectSocket(nextRole), 1000);
  } else {
    console.log('\n✅ All tests completed!');
    process.exit(0);
  }
}

// Start testing with first role
console.log('🧪 Starting Socket.IO Connection Test');
console.log(`Using session ID: ${TEST_SESSION_ID}`);
console.log(`Ensure your .env file has the correct NEXT_PUBLIC_SOCKET_URL (currently: ${SOCKET_URL})`);
console.log(`Make sure your Next.js server is running at ${SOCKET_URL}`);
console.log('\nPress Ctrl+C to abort the test\n');
connectSocket(roles[currentRoleIndex]);
