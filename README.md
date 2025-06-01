# STEMuiz

A real-time quiz application for STEM High Schools, built with Next.js, Socket.io, and MongoDB.

![STEMuiz Screenshot](screenshot.png)

## Features

- ✅ Real-time multiplayer quiz experience
- ✅ Mobile-friendly responsive design
- ✅ Host and player interfaces
- ✅ Custom quiz creation for STEM subjects
- ✅ Multiple choice and true/false questions
- ✅ Random question ordering
- ✅ Leaderboards with real-time updates
- ✅ Achievements and badges system
- ✅ Time-based scoring
- ✅ Answer streaks for bonus motivation

## Tech Stack

- **Frontend**: Next.js, React, SCSS (BEM methodology)
- **Backend**: Node.js, Express, Socket.io
- **Database**: MongoDB
- **Authentication**: Supabase Auth
- **Hosting**: Vercel (frontend), Railway/Heroku/Render (backend)

## Prerequisites

- Node.js 16+
- MongoDB
- Supabase account

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/stemuiz.git
cd stemuiz
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the root directory:

```
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret

# Socket.IO Configuration
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

### 4. Set up the database

Run the SQL migrations to set up your database schema:

```bash
# Run the latest schema migration
cat migration.sql | psql your_database_connection_string
```

### 5. Start the development servers

Start the Next.js frontend server:

```bash
npm run dev
```

In a separate terminal, start the Socket.io server:

```bash
node server/index.js
```

## Project Structure

```
kahoot-clone/
├── components/             # Reusable UI components
├── contexts/               # React contexts
├── lib/                    # Utilities and services
├── pages/                  # Next.js pages
│   ├── api/                # API routes
│   ├── auth/               # Authentication pages
│   ├── dashboard/          # User dashboard
│   ├── host/               # Game host interface
│   ├── play/               # Game player interface
│   └── quiz/               # Quiz management
├── public/                 # Static assets
├── server/                 # Socket.io server
├── styles/                 # Global SCSS styles
└── migration.sql           # Database schema
```

## Game Flow

1. **Host creates a quiz**: Customizable questions, options, and settings
2. **Host starts a game session**: Generates a unique game PIN
3. **Players join using the PIN**: Enter nickname to join
4. **Host starts the game**: All players see the same questions in real-time
5. **Players answer questions**: Points awarded based on correctness and speed
6. **Leaderboard updates**: After each question
7. **Game ends**: Final results displayed to all participants

## Deployment

### Frontend (Next.js)

Deploy to Vercel:
1. Connect your GitHub repository
2. Configure environment variables
3. Deploy

### Backend (Socket.io Server)

Deploy to Railway, Heroku, or Render:
1. Set up a new web service
2. Configure environment variables
3. Set up the deployment pipeline

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Socket.io](https://socket.io/) for real-time communication
- [Next.js](https://nextjs.org/) for the React framework
- [Supabase](https://supabase.io/) for authentication
- [MongoDB](https://www.mongodb.com/) for database services

## Database Setup

### Creating the Profiles Table

If you encounter a 404 error related to the `profiles` table, you need to run the following SQL in your Supabase SQL editor:

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Allow users to view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Add function to handle new user profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (new.id, new.raw_user_meta_data->>'name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

Steps to run this migration:
1. Log in to your Supabase account
2. Open your project
3. Go to the SQL Editor
4. Create a new query, paste the SQL above, and click "Run"

### Handling Row-Level Security (RLS) Issues

If you encounter "row violates row-level security policy" errors, you need to add additional policies or temporarily disable RLS. Run the following SQL:

```sql
-- Allow public read access to profiles (useful for leaderboards, user listings)
CREATE POLICY "Anyone can view profiles"
  ON public.profiles
  FOR SELECT
  USING (true);

-- For admin operations, you can temporarily disable RLS
-- Only do this when running migrations or repairs
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Run your repair operations here, for example:
INSERT INTO public.profiles (id, name, created_at, updated_at)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'name', email),
  NOW(),
  NOW()
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Then re-enable RLS when done
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
```

If you need administrative access to tables with RLS enabled, consider using a service role key or using Supabase's management APIs.

## Database Fix for player_answers table

If you encounter the error `ERROR: 42703: column "session_id" does not exist`, you need to fix the player_answers table structure. You can do this by:

1. Log into your Supabase Dashboard
2. Go to the SQL Editor
3. Copy and paste the following SQL:

```sql
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
```

4. Run the query

This will add the missing `session_id` column to the player_answers table if it's missing.

## Development

To run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.