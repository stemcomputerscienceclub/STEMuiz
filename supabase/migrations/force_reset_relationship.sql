-- Force reset the schema cache
SELECT pg_catalog.pg_reload_conf();

-- Disable RLS temporarily
ALTER TABLE IF EXISTS public.players DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.game_sessions DISABLE ROW LEVEL SECURITY;

-- First, let's check if our tables exist
DO $$
DECLARE
  game_sessions_exists BOOLEAN;
  players_exists BOOLEAN;
  player_sessions_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'game_sessions'
  ) INTO game_sessions_exists;
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'players'
  ) INTO players_exists;
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'player_sessions'
  ) INTO player_sessions_exists;

  -- If game_sessions doesn't exist, create it
  IF NOT game_sessions_exists THEN
    CREATE TABLE public.game_sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      quiz_id UUID NOT NULL,
      host_id UUID NOT NULL,
      pin TEXT NOT NULL,
      status TEXT DEFAULT 'waiting',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
      ended_at TIMESTAMP WITH TIME ZONE
    );
    
    -- Create index for host_id for faster lookups
    CREATE INDEX game_sessions_host_id_idx ON public.game_sessions(host_id);
    -- Create unique index for pin
    CREATE UNIQUE INDEX game_sessions_pin_idx ON public.game_sessions(pin) WHERE status != 'ended';
  END IF;

  -- If players doesn't exist, create it
  IF NOT players_exists THEN
    CREATE TABLE public.players (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      session_id UUID REFERENCES public.game_sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      score INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
    );
    
    -- Create index for session_id for faster lookups
    CREATE INDEX players_session_id_idx ON public.players(session_id);
  END IF;
  
  -- Now ensure the players table has the correct session_id column
  IF players_exists THEN
    BEGIN
      -- Check if session_id column exists
      IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'players' AND column_name = 'session_id'
      ) THEN
        -- Add session_id column with correct reference
        ALTER TABLE public.players ADD COLUMN session_id UUID;
        -- Add foreign key constraint
        ALTER TABLE public.players ADD CONSTRAINT players_session_id_fkey 
          FOREIGN KEY (session_id) REFERENCES public.game_sessions(id) ON DELETE CASCADE;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error adding session_id column: %', SQLERRM;
    END;
  END IF;
  
  -- Drop and recreate any views that might be caching the schema
  DROP VIEW IF EXISTS public.active_game_sessions;
  
  -- Create a view that joins game_sessions with players
  CREATE OR REPLACE VIEW public.active_game_sessions AS
  SELECT 
    gs.*,
    COUNT(p.id) AS player_count
  FROM 
    public.game_sessions gs
  LEFT JOIN 
    public.players p ON p.session_id = gs.id
  WHERE 
    gs.status != 'ended'
  GROUP BY 
    gs.id;
    
  -- Add comment to remind about the relationship
  COMMENT ON TABLE public.players IS 'Players participating in game sessions. Related to game_sessions table via session_id.';
  COMMENT ON COLUMN public.players.session_id IS 'Foreign key to game_sessions.id';
END $$;

-- Reset RLS
ALTER TABLE IF EXISTS public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.game_sessions ENABLE ROW LEVEL SECURITY;

-- Explicitly create policies for these tables
DROP POLICY IF EXISTS "Allow all access to game_sessions" ON public.game_sessions;
CREATE POLICY "Allow all access to game_sessions" ON public.game_sessions USING (true);

DROP POLICY IF EXISTS "Allow all access to players" ON public.players;
CREATE POLICY "Allow all access to players" ON public.players USING (true);

-- Refresh the schema again
SELECT pg_catalog.pg_reload_conf(); 