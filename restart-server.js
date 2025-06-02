const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Restarting Socket.IO server...');

try {
  // Windows-specific command to find and kill process using port 3001
  console.log('Looking for processes using port 3001...');
  const findCommand = 'netstat -ano | findstr :3001';
  const result = execSync(findCommand, { encoding: 'utf8' });
  
  // Extract PID from the result
  const lines = result.split('\n').filter(line => line.includes('LISTENING'));
  
  if (lines.length > 0) {
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        const pid = parts[4];
        console.log(`Found process using port 3001 with PID: ${pid}`);
        
        // Kill the process
        console.log(`Killing process ${pid}...`);
        execSync(`taskkill /F /PID ${pid}`);
        console.log(`Process ${pid} terminated.`);
      }
    }
  } else {
    console.log('No process found using port 3001.');
  }
} catch (error) {
  console.log('No active process found on port 3001 or error killing process:', error.message);
}

// Wait a moment for the port to be released
setTimeout(() => {
  try {
    // Start the server
    console.log('Starting Socket.IO server...');
    require('./server/index.js');
  } catch (error) {
    console.error('Failed to start server:', error);
  }
}, 1000); 