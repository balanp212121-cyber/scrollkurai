-- Drop the overly permissive policy
DROP POLICY IF EXISTS "authenticated_view_profiles" ON public.profiles;

-- Create policy for users to view their own complete profile
CREATE POLICY "users_view_own_profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Create a view for public profile data (leaderboard-safe data)
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  username,
  xp,
  level,
  streak,
  archetype
FROM public.profiles;

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.public_profiles TO authenticated;

-- Add RLS policies for other profile operations (keep existing)
-- The authenticated_insert_own and authenticated_update_own policies remain unchanged