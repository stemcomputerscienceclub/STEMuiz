-- SQL script to create the players table in Supabase

-- Create the players table
CREATE TABLE IF NOT EXISTS public.players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS players_session_id_idx ON public.players(session_id);

-- Add RLS policies for security
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Policy to allow select on players
CREATE POLICY "Allow public read access to players" 
ON public.players
FOR SELECT 
USING (true);

-- Policy to allow insert on players
CREATE POLICY "Allow authenticated insert to players" 
ON public.players
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Policy to allow update on players
CREATE POLICY "Allow update of own players" 
ON public.players
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

-- Add comment to table
COMMENT ON TABLE public.players IS 'Table to store player information for game sessions';
