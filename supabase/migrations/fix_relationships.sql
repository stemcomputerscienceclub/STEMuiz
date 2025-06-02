-- Fix all database relationship issues in one migration
-- This handles:
-- 1. quizzes <-> questions relationship
-- 2. profiles table issues
-- 3. game_sessions <-> players relationship
-- 4. player_answers issues

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
    
    -- Ensure foreign key constraint exists
    IF NOT EXISTS (
      SELECT FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_schema = 'public' 
        AND tc.table_name = 'questions'
        AND ccu.table_name = 'quizzes'
    ) THEN
      -- Add the constraint if it doesn't exist
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
    
    -- Ensure foreign key constraint exists
    IF NOT EXISTS (
      SELECT FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_schema = 'public' 
        AND tc.table_name = 'players'
        AND ccu.table_name = 'game_sessions'
    ) THEN
      -- Add the constraint if it doesn't exist
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