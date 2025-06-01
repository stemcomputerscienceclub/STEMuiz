-- Allow full access for service role (to be used with admin tokens)
CREATE POLICY "Service role has full access"
  ON public.profiles
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Allow public read access to profiles (useful for leaderboards, user listings)
CREATE POLICY "Anyone can view profiles"
  ON public.profiles
  FOR SELECT
  USING (true);

-- This fixes the issue with migrations and existing profiles
-- Temporarily disable RLS to allow migration scripts to run
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Run your migration/fix scripts here
-- For example, this would ensure all existing users have profiles:
INSERT INTO public.profiles (id, name, created_at, updated_at)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'name', email),
  NOW(),
  NOW()
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Re-enable RLS after migration
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY; 