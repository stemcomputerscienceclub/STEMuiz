# STEMuiz Troubleshooting Guide

This guide helps you fix the most common issues with STEMuiz.

## Quick Fixes

### 1. Socket.IO Connection Issues

If you see errors like `Failed to load resource: the server responded with a status of 404 ()` for `/socket.io` endpoints:

```
Run this command to restart the Socket.IO server:
```bash
npm run fix-socket
```

Or check if the server is running and start it if needed:
```bash
npm run check-server
```

### 2. Database Connection Issues

If you see errors like `Failed to load game session` or `Failed to load resource: the server responded with a status of 400 ()`:

1. Check your Supabase environment variables:

```bash
# Make sure these are correctly set in .env.local
NEXT_PUBLIC_SUPABASE_URL=https://ienrswngtfwenmramsjn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

2. Apply the database fixes:

```bash
npm run deploy-migration
```

## Step-by-Step Troubleshooting

### Socket.IO Connection

1. **Check if Socket.IO server is running**
   - Run `npm run check-server` to verify and start if needed
   - The server should be running on port 3001

2. **Verify Socket.IO path**
   - The client should connect to `/socket.io` (not `/socket`)
   - Check browser console for connection logs

3. **Check for port conflicts**
   - If port 3001 is already in use, run `npm run fix-socket`

### Database Issues

1. **Verify Supabase connection**
   - Check if you can access your Supabase dashboard
   - Ensure your API keys are correct in `.env.local`

2. **Fix database relationships**
   - Run `npm run deploy-migration` to apply fixes
   - This will ensure all tables have the correct relationships

3. **Check for missing tables**
   - If you see errors about missing tables, check the database schema
   - Apply the SQL from `DATABASE_FIX.md` if needed

## Common Error Messages

### "Failed to load game session"
- Cause: Database relationship issues or missing tables
- Fix: Run `npm run deploy-migration`

### "Socket.IO connection error: xhr poll error"
- Cause: Socket.IO server not running or wrong path
- Fix: Run `npm run fix-socket` or `npm run check-server`

### "404 Not Found" for Socket.IO
- Cause: Socket.IO server not running or misconfigured
- Fix: Run `npm run check-server`

## Getting Additional Help

If you're still experiencing issues:

1. Check the detailed logs in your browser console (F12)
2. Review the server logs (check the terminal running the Socket.IO server)
3. Refer to the documentation in `SOCKET_TROUBLESHOOTING.md` and `DATABASE_FIX.md`

## Full Reset Procedure

If all else fails, try this full reset procedure:

1. Stop all running servers
2. Delete the `.next` folder
3. Run `npm run fix-socket` to restart the Socket.IO server
4. Run `npm run deploy-migration` to fix database issues
5. Restart the application with `npm run dev` 