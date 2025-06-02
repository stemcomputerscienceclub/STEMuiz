const http = require('http');
const { execSync } = require('child_process');
const path = require('path');

console.log('Checking if Socket.IO server is running...');

// Function to check if server is running
function isServerRunning() {
  return new Promise((resolve) => {
    const req = http.request({
      host: 'localhost',
      port: 3001,
      path: '/health',
      method: 'GET',
      timeout: 2000
    }, (res) => {
      if (res.statusCode === 200) {
        console.log('Socket.IO server is running!');
        resolve(true);
      } else {
        console.log(`Socket.IO server returned status: ${res.statusCode}`);
        resolve(false);
      }
    });

    req.on('error', () => {
      console.log('Socket.IO server is not running.');
      resolve(false);
    });

    req.on('timeout', () => {
      console.log('Socket.IO server check timed out.');
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Main function
async function main() {
  try {
    const serverRunning = await isServerRunning();
    
    if (!serverRunning) {
      console.log('Starting Socket.IO server...');
      
      // On Windows, use start command to run in a new window
      if (process.platform === 'win32') {
        try {
          execSync('start cmd.exe /K "cd /d %cd% && node server/index.js"', {
            stdio: 'inherit',
            shell: true
          });
          console.log('Socket.IO server started in a new window.');
        } catch (error) {
          console.error('Failed to start Socket.IO server:', error);
        }
      } else {
        // On Unix-like systems, use spawn
        const { spawn } = require('child_process');
        const serverProcess = spawn('node', ['server/index.js'], {
          detached: true,
          stdio: 'ignore'
        });
        
        serverProcess.unref();
        console.log('Socket.IO server started in background.');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 