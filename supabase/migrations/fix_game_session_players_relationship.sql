-- Check if using players or player_sessions table
DO $$
DECLARE
  players_table_exists BOOLEAN;
  player_sessions_table_exists BOOLEAN;
BEGIN
  -- Check which tables exist
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'players'
  ) INTO players_table_exists;
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'player_sessions'
  ) INTO player_sessions_table_exists;

  -- Create or modify the tables based on what exists
  IF players_table_exists THEN
    -- If the players table exists but has the wrong column name
    BEGIN
      -- Check if session_id column exists
      IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'players' 
        AND column_name = 'session_id'
      ) THEN
        -- Add session_id column if it doesn't exist
        ALTER TABLE public.players ADD COLUMN session_id UUID REFERENCES public.game_sessions(id);
      END IF;
      
      -- Create index for better performance
      CREATE INDEX IF NOT EXISTS players_session_id_idx ON public.players(session_id);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Error modifying players table: %', SQLERRM;
    END;
  END IF;
  
  IF player_sessions_table_exists THEN
    -- If the player_sessions table exists but has the wrong column name
    BEGIN
      -- Check if game_session_id column exists
      IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'player_sessions' 
        AND column_name = 'game_session_id'
      ) THEN
        -- Add game_session_id column if it doesn't exist
        ALTER TABLE public.player_sessions ADD COLUMN game_session_id UUID REFERENCES public.game_sessions(id);
      END IF;
      
      -- Create index for better performance
      CREATE INDEX IF NOT EXISTS player_sessions_game_id_idx ON public.player_sessions(game_session_id);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Error modifying player_sessions table: %', SQLERRM;
    END;
  END IF;
  
  -- Create players table if neither exists (using our standard schema)
  IF NOT players_table_exists AND NOT player_sessions_table_exists THEN
    CREATE TABLE public.players (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      session_id UUID REFERENCES public.game_sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      score INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
    );
    
    -- Create index for better performance
    CREATE INDEX players_session_id_idx ON public.players(session_id);
  END IF;
END $$; 