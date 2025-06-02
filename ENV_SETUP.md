# Environment Setup Guide

This guide helps you set up the necessary environment variables to fix both database connection and Socket.IO issues.

## 1. Create or Update `.env.local` File

Create a `.env.local` file in the root of your project with the following content:

```
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://ienrswngtfwenmramsjn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Application URL
NEXT_PUBLIC_APP_URL=https://stemuiz.stemcsclub.org

# Socket.IO Configuration - CRITICAL FIX
NEXT_PUBLIC_SOCKET_URL=/socket.io

# Service Role Key (only use server-side)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## 2. Set Up Socket.IO Server Environment

Create a `.env` file in the `server` directory:

```
# Server configuration
PORT=3001

# CORS configuration - set this to your deployment URL
NEXT_PUBLIC_APP_URL=https://stemuiz.stemcsclub.org
```

## 3. Apply Database Fixes

Run the following command to apply the database migrations that fix the relationship issues:

```
npm run deploy-migration -- -f supabase/migrations/fix_relationships.sql
```

## 4. Verify Deployment

After setting up the environment variables and applying the database fixes:

1. Restart your application
2. Check browser console for connection errors
3. Verify database queries are successful

## Socket.IO Connection Troubleshooting

If you're still having Socket.IO connection issues:

1. **Check your deployment platform configuration:**
   - For Vercel: Add the environment variables in the Vercel dashboard
   - For other platforms: Ensure the Socket.IO server is running alongside your Next.js app

2. **For Nginx deployments:**
   Make sure your Nginx configuration properly handles WebSocket connections:

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

3. **Start both servers in production:**
   Add a `start` script to your `package.json`:

```json
"scripts": {
  "start": "concurrently \"next start\" \"node server/index.js\"",
  "build": "next build"
}
``` 