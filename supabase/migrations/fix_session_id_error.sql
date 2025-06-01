-- Simple fix for the session_id column in player_answers table

-- Check if player_answers table exists
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
    
    RAISE NOTICE 'Added session_id column to player_answers table';
  ELSE
    RAISE NOTICE 'No changes needed - either table does not exist or column already exists';
  END IF;
END $$; 