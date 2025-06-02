# STEMuiz Vercel Deployment Guide

This guide explains how STEMuiz has been refactored to work seamlessly with Vercel deployment.

## Architecture Changes

### 1. Integrated Socket.IO Server

Instead of running a separate Socket.IO server, we've integrated it directly into the Next.js application using Next.js API routes:

- `/api/socket` - Handles all Socket.IO connections
- `/api/health` - Simple health check endpoint

This approach leverages Vercel's support for WebSockets through their Edge Functions, allowing real-time communication without a separate server.

### 2. In-Memory Game State

Game sessions are stored in memory within the Socket.IO server instance. This works well for:
- Short-lived game sessions
- Deployments with sticky sessions

For production with multiple instances, consider using:
- Redis for shared state (via Upstash)
- Database for persistent game state

### 3. Client-Side Connection

The client now connects to the same domain using the `/api/socket` path:

```javascript
const socket = io(window.location.origin, {
  path: '/api/socket',
  // other options...
});
```

## Deployment Steps

1. **Push to GitHub**:
   - Vercel will automatically deploy from your GitHub repository

2. **Configure Environment Variables in Vercel**:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://ienrswngtfwenmramsjn.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
   ```

3. **Deploy Database Migrations**:
   - Run `npm run deploy-migration` to set up your Supabase database

## Limitations & Considerations

### WebSocket Connection Limits

Vercel has some limitations for WebSocket connections:
- Maximum connection time: 5 minutes
- Reconnection handling is important

### Memory Constraints

Since game state is stored in memory:
- Each serverless function instance has limited memory
- Long-running games with many players might need database persistence

### Cold Starts

Serverless functions can experience cold starts:
- First connection might be slower
- Consider keeping the function warm with periodic pings

## Scaling Considerations

For larger deployments:

1. **Database Integration**:
   - Store game sessions in Supabase
   - Use Supabase Realtime for additional pub/sub features

2. **Redis for State Management**:
   - Use Upstash Redis for shared state across instances
   - Implement Socket.IO Redis adapter

3. **Dedicated WebSocket Server**:
   - For very high traffic, consider a dedicated WebSocket server on Railway/Render
   - Use Vercel for the frontend and API routes 