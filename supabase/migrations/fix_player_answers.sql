-- Fix player_answers table issues

-- First check if the table exists
DO $$
DECLARE
  player_answers_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'player_answers'
  ) INTO player_answers_exists;

  -- If table exists, check and add missing columns
  IF player_answers_exists THEN
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
      
      -- Create index for performance
      CREATE INDEX player_answers_session_id_idx ON public.player_answers(session_id);
      
      -- Populate session_id from players table if possible
      UPDATE public.player_answers pa
      SET session_id = p.session_id
      FROM public.players p
      WHERE pa.player_id = p.id AND pa.session_id IS NULL;
    END IF;
  ELSE
    -- Create player_answers table with all required columns
    CREATE TABLE public.player_answers (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
      session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
      question_id UUID NOT NULL,
      selected_option INTEGER,
      is_correct BOOLEAN,
      points INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
    );
    
    -- Create indexes for better performance
    CREATE INDEX player_answers_player_id_idx ON public.player_answers(player_id);
    CREATE INDEX player_answers_session_id_idx ON public.player_answers(session_id);
  END IF;
END $$;

-- Ensure RLS is enabled and proper policies are in place
ALTER TABLE IF EXISTS public.player_answers ENABLE ROW LEVEL SECURITY;

-- Player answers policies
DROP POLICY IF EXISTS "Public access to player_answers" ON public.player_answers;
DROP POLICY IF EXISTS "Anyone can view player answers" ON public.player_answers;
DROP POLICY IF EXISTS "Players can create their own answers" ON public.player_answers;
DROP POLICY IF EXISTS "Host can manage player answers" ON public.player_answers;
DROP POLICY IF EXISTS "Service role has full access to player_answers" ON public.player_answers;

-- Recreate policies
CREATE POLICY "Anyone can view player answers" ON public.player_answers
  FOR SELECT
  USING (true);

CREATE POLICY "Players can create their own answers" ON public.player_answers
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Host can manage player answers" ON public.player_answers
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.game_sessions gs
    WHERE gs.id = session_id AND gs.host_id = auth.uid()
  ));

CREATE POLICY "Service role has full access to player_answers" ON public.player_answers
  FOR ALL
  TO service_role
  USING (true);

-- Grant necessary permissions
GRANT ALL ON public.player_answers TO anon, authenticated, service_role; 