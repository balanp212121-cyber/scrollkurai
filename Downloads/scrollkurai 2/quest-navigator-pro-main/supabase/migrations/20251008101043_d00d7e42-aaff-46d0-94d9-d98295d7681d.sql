-- Fix the security definer view issue
-- Drop the view and rely on RLS policies instead
DROP VIEW IF EXISTS public.leaderboard_profiles;

-- The profiles table already has "Users can view all profiles" policy
-- This is secure because RLS is enforced and all users can see leaderboard data

-- Add a comment to document the security model
COMMENT ON TABLE public.profiles IS 'User profiles with public leaderboard data. All authenticated users can view profiles for leaderboard functionality. Users can only update their own profile excluding premium_status.';