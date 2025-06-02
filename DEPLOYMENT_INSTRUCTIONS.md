# Deployment Instructions for STEMuiz

This guide provides step-by-step instructions to fix both the database relationship issues and Socket.IO connection problems.

## 1. Fix Database Relationship Issues

### Step 1: Set up the required environment variables

Create or update your `.env.local` file with the following:

```
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://ienrswngtfwenmramsjn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Service Role Key (server-side only)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

You can find your service role key in your Supabase dashboard under Project Settings > API.

### Step 2: Deploy the database migration

Run the following command to apply the database fixes:

```bash
npm run deploy-migration -- -f supabase/migrations/fix_relationships.sql
```

### Step 3: Manual SQL Fix (Alternative)

If the migration script doesn't work, you can run this SQL directly in the Supabase SQL Editor:

```sql
-- Fix all database relationship issues in one migration
DO $$
DECLARE
  quizzes_exists BOOLEAN;
  questions_exists BOOLEAN;
  profiles_exists BOOLEAN;
BEGIN
  -- Check if tables exist
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'quizzes'
  ) INTO quizzes_exists;
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'questions'
  ) INTO questions_exists;
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) INTO profiles_exists;

  -- Fix profiles table
  IF NOT profiles_exists THEN
    -- Create profiles table if it doesn't exist
    CREATE TABLE public.profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      name TEXT,
      avatar_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
    );
    
    -- Add RLS policies for profiles
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    
    -- Public profiles are viewable by everyone
    CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
      FOR SELECT USING (true);
      
    -- Users can insert their own profile
    CREATE POLICY "Users can insert their own profile" ON public.profiles
      FOR INSERT WITH CHECK (auth.uid() = id);
      
    -- Users can update their own profile
    CREATE POLICY "Users can update their own profile" ON public.profiles
      FOR UPDATE USING (auth.uid() = id);
  ELSE
    -- Ensure avatar_url column exists
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'avatar_url'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
    END IF;
  END IF;

  -- Fix quizzes <-> questions relationship
  IF quizzes_exists AND questions_exists THEN
    -- Check if quiz_id column exists in questions table
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'questions' 
      AND column_name = 'quiz_id'
    ) THEN
      -- Add quiz_id column
      ALTER TABLE public.questions ADD COLUMN quiz_id UUID;
      
      -- Add foreign key constraint
      ALTER TABLE public.questions ADD CONSTRAINT questions_quiz_id_fkey 
        FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;
    END IF;
  END IF;

  -- Fix game_sessions <-> players relationship
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'game_sessions'
  ) AND EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'players'
  ) THEN
    -- Check if session_id column exists in players table
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'players' 
      AND column_name = 'session_id'
    ) THEN
      -- Add session_id column
      ALTER TABLE public.players ADD COLUMN session_id UUID;
      
      -- Add foreign key constraint
      ALTER TABLE public.players ADD CONSTRAINT players_session_id_fkey 
        FOREIGN KEY (session_id) REFERENCES public.game_sessions(id) ON DELETE CASCADE;
    END IF;
  END IF;

  -- Fix player_answers table
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'player_answers'
  ) THEN
    -- Check if session_id column exists
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'player_answers' 
      AND column_name = 'session_id'
    ) THEN
      -- Add session_id column
      ALTER TABLE public.player_answers ADD COLUMN session_id UUID;
      
      -- Add foreign key constraint
      ALTER TABLE public.player_answers ADD CONSTRAINT player_answers_session_id_fkey 
        FOREIGN KEY (session_id) REFERENCES public.game_sessions(id) ON DELETE CASCADE;
    END IF;
  END IF;
END
$$;
```

## 2. Fix Socket.IO Connection Issues

### Step 1: Update environment variables

Add the following to your `.env.local` file:

```
# Socket.IO Configuration - CRITICAL FIX
NEXT_PUBLIC_SOCKET_URL=/socket.io
```

### Step 2: Deploy the updated socket.js file

Make sure the updated `lib/socket.js` file is deployed, which fixes the path to use `/socket.io` instead of `/socket`.

### Step 3: Server configuration for Socket.IO

Make sure your `server/index.js` has the proper configuration:

```javascript
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || ['http://localhost:3000', 'https://stemuiz.stemcsclub.org'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Ensure path is set to /socket.io
  path: '/socket.io',
  pingTimeout: 30000,
  pingInterval: 10000,
  transports: ['websocket', 'polling'],
  allowEIO3: true
});
```

### Step 4: Update Nginx configuration (if applicable)

If you're using Nginx as a reverse proxy, ensure your configuration properly handles WebSocket connections:

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

## 3. Deployment Process

### Step 1: Build the application

```bash
npm run build
```

### Step 2: Start both the Next.js and Socket.IO servers

Use the updated start script in package.json:

```bash
npm run start
```

This will run both the Next.js server and the Socket.IO server concurrently.

## 4. Verifying the Fix

After deploying these changes:

1. Check the browser console for any connection errors
2. Verify database queries are successful
3. Check that Socket.IO connections are established
4. Ensure game sessions can be created and joined

## 5. Troubleshooting

If you still encounter issues:

### Database Issues:
- Check Supabase logs for specific error messages
- Verify RLS policies are correctly set up
- Ensure your service role key has the necessary permissions

### Socket.IO Issues:
- Check that the Socket.IO server is running on port 3001
- Verify the client is attempting to connect to the correct URL/path
- Check network logs for any connection errors
- Ensure CORS is properly configured 