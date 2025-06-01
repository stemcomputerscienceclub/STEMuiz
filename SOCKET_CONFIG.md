# Socket.IO Connection Troubleshooting

## Connection Issues

Based on the errors you're experiencing:

```
GET https://stemuiz.stemcsclub.org/socket.io?sessionId=...&role=host&name=null&EIO=4&transport=polling 404 (Not Found)
Socket connection error: xhr poll error
```

The Socket.IO client is trying to connect to `wss://stemuiz.stemcsclub.org/socket` but failing with a 404 error. This indicates one of the following issues:

1. The Socket.IO server is not running at that URL
2. The URL path is incorrect
3. The server is not properly configured for WebSocket connections

## Solution

### 1. Check Socket.IO Server Deployment

Make sure your Socket.IO server (from `server/index.js`) is properly deployed and running. If you're using a separate domain for the socket server, ensure it's configured correctly.

### 2. Update Environment Variables

Create or update your `.env.local` file with the correct Socket.IO server URL:

```
# Socket.IO Configuration
# For separate socket server:
NEXT_PUBLIC_SOCKET_URL=https://your-socket-server-url.com

# OR for socket server on same domain but different path:
NEXT_PUBLIC_SOCKET_URL=/socket.io
```

### 3. Configure Socket.IO Server with Proper CORS

Ensure your Socket.IO server has proper CORS configuration:

```javascript
// In server/index.js
const io = new Server(httpServer, {
  cors: {
    origin: ["https://stemuiz.stemcsclub.org", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
  },
  path: '/socket.io', // Make sure this matches your client config
});
```

### 4. Deployment Setup

If you're deploying the Socket.IO server as part of the same application:

1. Ensure you have a proper start script in your `package.json`:
   ```json
   "scripts": {
     "start": "node server/index.js",
     "build": "next build"
   }
   ```

2. Configure your hosting provider to run both Next.js and the Socket.IO server.

### 5. Nginx Configuration (if applicable)

If you're using Nginx as a reverse proxy, make sure it's configured to handle WebSocket connections:

```nginx
server {
    listen 80;
    server_name stemuiz.stemcsclub.org;

    location / {
        proxy_pass http://localhost:3000;  # Next.js app
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3001;  # Socket.IO server
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 6. Check Client Configuration

Make sure your client is using the correct Socket.IO URL and path:

```javascript
// In lib/socket.js
const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

const socket = io(socketUrl, {
  path: '/socket.io', // This should match your server configuration
  transports: ['websocket', 'polling'],
  // other options...
});
```

## Testing the Connection

You can test your Socket.IO connection by:

1. Opening your browser's developer tools
2. Going to the Network tab
3. Filtering for "socket.io" or "ws" (WebSocket)
4. Checking if the connection is established successfully

## Debugging

Add more detailed logging to help diagnose the issue:

```javascript
// In lib/socket.js
console.log(`Attempting to connect to Socket.IO server at: ${socketUrl}`);

socket.on('connect', () => {
  console.log('Socket.IO connection successful!');
});

socket.on('connect_error', (error) => {
  console.error('Socket.IO connection error:', error);
  console.error('Error details:', error.message);
});
```

If the issue persists, check your server logs for any errors related to WebSocket connections or CORS issues. 