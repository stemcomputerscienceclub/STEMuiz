    -- This migration will fix all database issues in one go

    -- First, let's check if the profiles table exists and create it if needed
    DO $$
    DECLARE
    profiles_exists BOOLEAN;
    avatar_url_exists BOOLEAN;
    BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'profiles'
    ) INTO profiles_exists;

    -- Check if avatar_url column exists in profiles table
    IF profiles_exists THEN
        SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'avatar_url'
        ) INTO avatar_url_exists;
        
        -- Add avatar_url column if it doesn't exist
        IF NOT avatar_url_exists THEN
        ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
        END IF;
    END IF;

    IF NOT profiles_exists THEN
        CREATE TABLE public.profiles (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        name TEXT,
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
        );

        -- Create index for faster lookups
        CREATE INDEX profiles_id_idx ON public.profiles(id);
        
        -- Comment on table
        COMMENT ON TABLE public.profiles IS 'User profiles for the application';
    END IF;
    END $$;

    -- Create trigger to automatically create profiles for new users
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $$
    BEGIN
    INSERT INTO public.profiles (id, name)
    VALUES (new.id, new.email)
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Make sure the trigger is created only once
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

    -- Fix existing users without profiles
    INSERT INTO public.profiles (id, name)
    SELECT id, email FROM auth.users 
    WHERE id NOT IN (SELECT id FROM public.profiles)
    ON CONFLICT (id) DO NOTHING;

    -- Now let's fix the game_sessions and players tables
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
        
        -- Create indexes for faster lookups
        CREATE INDEX game_sessions_host_id_idx ON public.game_sessions(host_id);
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
        
        -- Create index for faster lookups
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
    
    -- Create player_answers table if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'player_answers'
    ) THEN
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
        
        -- Create indexes for faster lookups
        CREATE INDEX player_answers_player_id_idx ON public.player_answers(player_id);
        CREATE INDEX player_answers_session_id_idx ON public.player_answers(session_id);
    ELSE
        -- Check if player_answers table has session_id column and add it if not
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

    -- Reset/fix Row Level Security policies
    ALTER TABLE IF EXISTS public.players ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.game_sessions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.player_answers ENABLE ROW LEVEL SECURITY;

    -- Game sessions policies
    DROP POLICY IF EXISTS "Allow all access to game_sessions" ON public.game_sessions;
    DROP POLICY IF EXISTS "Service role access for game_sessions" ON public.game_sessions;
    DROP POLICY IF EXISTS "Host can manage their game sessions" ON public.game_sessions;

    -- Create comprehensive policies for game_sessions
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
    DROP POLICY IF EXISTS "Allow all access to players" ON public.players;
    DROP POLICY IF EXISTS "Service role access for players" ON public.players;
    DROP POLICY IF EXISTS "Authenticated users can view players" ON public.players;

    -- Create comprehensive policies for players
    CREATE POLICY "Anyone can view players" ON public.players
    FOR SELECT
    USING (true);

    CREATE POLICY "Anyone can create players" ON public.players
    FOR INSERT
    WITH CHECK (true);

    CREATE POLICY "Host can manage players" ON public.players
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.game_sessions gs
        WHERE gs.id = session_id AND gs.host_id = auth.uid()
    ));

    CREATE POLICY "Service role has full access to players" ON public.players
    FOR ALL
    TO service_role
    USING (true);

    -- Profiles policies
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update their own profiles" ON public.profiles;

    CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT
    USING (true);

    CREATE POLICY "Users can update their own profiles" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

    CREATE POLICY "Service role has full access to profiles" ON public.profiles
    FOR ALL
    TO service_role
    USING (true);

    -- Player answers policies
    DROP POLICY IF EXISTS "Public access to player_answers" ON public.player_answers;

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
    GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

    -- Reset public schema permissions to be more permissive
    ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT ALL ON TABLES TO anon, authenticated, service_role;

    ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

    -- Create or replace RPC function to find game by PIN
    CREATE OR REPLACE FUNCTION public.find_game_by_pin(pin_code TEXT)
    RETURNS TABLE (
    id UUID,
    pin TEXT,
    status TEXT,
    host_id UUID,
    quiz_id UUID,
    created_at TIMESTAMPTZ
    ) 
    LANGUAGE SQL
    SECURITY DEFINER
    SET search_path = public
    AS $$
    SELECT id, pin, status, host_id, quiz_id, created_at
    FROM game_sessions
    WHERE pin = pin_code AND status != 'ended'
    LIMIT 1;
    $$; 