# STEMuiz Database Fix Instructions

This document provides instructions on how to fix the database issues in your Supabase setup. The main issues we've been addressing are:

1. Missing or incorrect profile table structure
2. Relationship issues between game_sessions and players tables
3. RLS policy permissions for game session creation

## Quick Fix Using SQL Editor

The fastest way to apply the fix is to:

1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy the SQL from `supabase/migrations/complete_fix.sql` 
4. Paste it into the SQL Editor
5. Run the query

This script is designed to be idempotent - it checks if tables/columns exist before creating them, so it's safe to run multiple times.

## Applying with Node.js Script

Alternatively, you can use the included deployment script:

1. Create a `.env.local` file with your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

2. Run the deployment script:
   ```bash
   npm run deploy-migration
   ```

## Manual Database Fixes

If the automated fixes don't work, here are the key issues to address manually:

### 1. Fix Profiles Table

```sql
-- Check if avatar_url column exists in profiles
ALTER TABLE IF EXISTS public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Make sure profiles table has proper RLS policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profiles" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

### 2. Fix Game Sessions Tables

```sql
-- Enable RLS
ALTER TABLE IF EXISTS public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.players ENABLE ROW LEVEL SECURITY;

-- Create proper policies
CREATE POLICY "Public can read active game sessions" ON public.game_sessions 
  FOR SELECT 
  USING (status != 'ended');

CREATE POLICY "Authenticated users can create game sessions" ON public.game_sessions 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host can manage their game sessions" ON public.game_sessions 
  FOR ALL 
  TO authenticated
  USING (auth.uid() = host_id);

CREATE POLICY "Service role has full access to game_sessions" ON public.game_sessions 
  FOR ALL 
  TO service_role
  USING (true);

-- Players policies
CREATE POLICY "Anyone can view players" ON public.players
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create players" ON public.players
  FOR INSERT
  WITH CHECK (true);
```

### 3. Fix Missing Relationships

```sql
-- Make sure players table has the correct session_id column
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_session_id_fkey;
ALTER TABLE public.players ADD CONSTRAINT players_session_id_fkey 
  FOREIGN KEY (session_id) REFERENCES public.game_sessions(id) ON DELETE CASCADE;
```

## Troubleshooting

If you're still experiencing issues:

1. Check the Supabase logs for specific error messages
2. Verify that your RLS policies are correctly set up
3. Make sure the service role key has full database access
4. Try running small parts of the migration script separately

For any additional questions or issues, please contact support. 