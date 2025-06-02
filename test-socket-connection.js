require('dotenv').config();
const { io } = require('socket.io-client');
const { v4: uuidv4 } = require('uuid');

// Test parameters
const sessionId = process.argv[2] || uuidv4();
const role = process.argv[3] || 'host';
const name = process.argv[4] || 'TestUser';

// Use localhost for testing
const socketUrl = 'http://localhost:3000';
const socketPath = '/api/socket';

console.log('Socket.IO Connection Test');
console.log('========================');
console.log(`URL: ${socketUrl}`);
console.log(`Path: ${socketPath}`);
console.log(`Session ID: ${sessionId}`);
console.log(`Role: ${role}`);
console.log(`Name: ${name}`);
console.log('========================\n');

// Create socket with the same configuration as in the client
const socket = io(socketUrl, {
  query: { sessionId, role, name },
  path: socketPath,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  transports: ['polling'],
  upgrade: false,
  forceNew: true,
  withCredentials: true,
});

// Log all events for debugging
socket.onAny((event, ...args) => {
  console.log(`[${new Date().toISOString()}] Event: ${event}`, args);
});

// Connection events
socket.on('connect', () => {
  console.log(`[${new Date().toISOString()}] Connected successfully!`);
  console.log(`Socket ID: ${socket.id}`);
  console.log(`Transport: ${socket.io.engine.transport.name}`);
  
  // Send a test message
  if (role === 'host') {
    console.log('Sending test host message...');
    socket.emit('host:test', { message: 'Test from host' });
  } else {
    console.log('Sending test player message...');
    socket.emit('player:test', { message: 'Test from player' });
  }
  
  // Disconnect after 10 seconds
  setTimeout(() => {
    console.log('Test complete, disconnecting...');
    socket.disconnect();
    process.exit(0);
  }, 10000);
});

socket.on('connect_error', (error) => {
  console.error(`[${new Date().toISOString()}] Connection error:`, error.message);
  console.log('Error details:', error);
  console.log('Current transport:', socket.io?.engine?.transport?.name);
  console.log('Transport options:', socket.io?.opts?.transports?.join(', '));
  console.log('Connection query params:', JSON.stringify(socket.io?.opts?.query));
  console.log('Extra headers:', JSON.stringify(socket.io?.opts?.extraHeaders));
  
  // Continue running to see if it eventually connects
});

socket.io.on("reconnect_attempt", (attempt) => {
  console.log(`[${new Date().toISOString()}] Reconnection attempt ${attempt}...`);
});

socket.io.on("reconnect", (attempt) => {
  console.log(`[${new Date().toISOString()}] Reconnected after ${attempt} attempts`);
});

socket.io.on("reconnect_error", (error) => {
  console.log(`[${new Date().toISOString()}] Reconnection error:`, error.message);
});

socket.io.on("reconnect_failed", () => {
  console.log(`[${new Date().toISOString()}] Reconnection failed after all attempts`);
  process.exit(1);
});

// Handle server response
socket.on('error', (error) => {
  console.error(`[${new Date().toISOString()}] Server error:`, error);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Interrupted, disconnecting socket...');
  socket.disconnect();
  process.exit(0);
});

console.log('Attempting to connect...');
