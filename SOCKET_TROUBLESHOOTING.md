# Socket.IO Connection Troubleshooting Guide

## Current Issue

The application is experiencing Socket.IO connection issues, specifically:
- 404 errors when trying to connect to `wss://stemuiz.stemcsclub.org/socket`
- The client is using the wrong path (`/socket` instead of `/socket.io`)
- Port 3001 conflicts (`EADDRINUSE: address already in use :::3001`)

## Quick Fixes

### 1. Restart the Socket.IO Server

If you encounter `EADDRINUSE: address already in use :::3001`, use the restart script:

```bash
node restart-server.js
```

This will automatically kill any process using port 3001 and restart the server.

### 2. Fix Client-Side Connection

The client-side Socket.IO connection has been updated to always use the `/socket.io` path, which is the standard path for Socket.IO. The updated configuration is in `lib/socket.js`.

## Verification Steps

To verify your Socket.IO connection is working properly:

1. Check your browser console for connection messages
2. Look for: `Socket.IO connection successful!` 
3. Confirm no more 404 errors for `/socket.io` requests

## Common Socket.IO Issues

### 1. Path Mismatch

The client and server must use the same path. The standard path is `/socket.io`.

**Server Configuration:**
```javascript
const io = new Server(httpServer, {
  // Must match client path
  path: '/socket.io',
  // ...other options
});
```

**Client Configuration:**
```javascript
const socket = io(url, {
  // Must match server path
  path: '/socket.io',
  // ...other options
});
```

### 2. CORS Issues

If you're seeing CORS errors:

**Server Configuration:**
```javascript
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'https://your-production-domain.com'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});
```

### 3. Transport Issues

If WebSocket connections fail, Socket.IO will automatically fall back to polling, but you can explicitly configure the transport methods:

```javascript
const socket = io(url, {
  transports: ['websocket', 'polling']
});
```

### 4. Proxy/Nginx Configuration

If you're using Nginx as a reverse proxy, ensure WebSocket connections are properly forwarded:

```nginx
location /socket.io/ {
  proxy_pass http://localhost:3001;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection 'upgrade';
  proxy_set_header Host $host;
  proxy_cache_bypass $http_upgrade;
}
```

## Testing the Connection

You can test your Socket.IO connection using this simple HTML file:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Socket.IO Test</title>
  <script src="https://cdn.socket.io/4.5.0/socket.io.min.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const socket = io(window.location.origin, {
        path: '/socket.io',
        transports: ['websocket', 'polling']
      });
      
      socket.on('connect', () => {
        document.getElementById('status').textContent = 'Connected!';
        document.getElementById('status').style.color = 'green';
      });
      
      socket.on('connect_error', (error) => {
        document.getElementById('status').textContent = 'Connection Error: ' + error;
        document.getElementById('status').style.color = 'red';
      });
    });
  </script>
</head>
<body>
  <h1>Socket.IO Connection Test</h1>
  <p>Status: <span id="status">Connecting...</span></p>
</body>
</html>
```

## Port In Use Solution

If the Socket.IO server port is already in use:

1. Find the process using the port:
   ```bash
   # Windows
   netstat -ano | findstr :3001
   
   # Linux/Mac
   lsof -i :3001
   ```

2. Kill the process:
   ```bash
   # Windows
   taskkill /F /PID <pid>
   
   # Linux/Mac
   kill -9 <pid>
   ```

3. Or use the restart script provided:
   ```bash
   node restart-server.js
   ``` 