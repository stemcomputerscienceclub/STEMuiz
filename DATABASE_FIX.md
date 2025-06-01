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

### Common Errors

#### ERROR: 42703: column "session_id" does not exist

This error indicates the player_answers table is missing the session_id column. Run this SQL fix:

```sql
-- Simple fix for the session_id column in player_answers table
DO $$
BEGIN
  -- Add session_id column if it doesn't exist
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'player_answers'
  ) AND NOT EXISTS (
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
    
    -- Create index for performance
    CREATE INDEX player_answers_session_id_idx ON public.player_answers(session_id);
    
    -- Populate session_id from players table if possible
    UPDATE public.player_answers pa
    SET session_id = p.session_id
    FROM public.players p
    WHERE pa.player_id = p.id AND pa.session_id IS NULL;
  END IF;
END $$;
```

#### ERROR: Could not find a relationship between 'quizzes' and 'questions'

This error occurs when the foreign key relationship between quizzes and questions is missing or broken. Fix it with this SQL:

```sql
-- Fix relationship between quizzes and questions tables
DO $$
BEGIN
  -- Check if both tables exist
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'quizzes'
  ) AND EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'questions'
  ) THEN
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
      
      -- Create index for better performance
      CREATE INDEX questions_quiz_id_idx ON public.questions(quiz_id);
    END IF;
    
    -- Also check relationship between questions and question_options
    IF EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'question_options'
    ) AND NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'question_options' 
      AND column_name = 'question_id'
    ) THEN
      -- Add question_id column
      ALTER TABLE public.question_options ADD COLUMN question_id UUID;
      
      -- Add foreign key constraint
      ALTER TABLE public.question_options ADD CONSTRAINT question_options_question_id_fkey 
        FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;
      
      -- Create index for better performance
      CREATE INDEX question_options_question_id_idx ON public.question_options(question_id);
    END IF;
  END IF;
END $$;
```

For any additional questions or issues, please contact support. 