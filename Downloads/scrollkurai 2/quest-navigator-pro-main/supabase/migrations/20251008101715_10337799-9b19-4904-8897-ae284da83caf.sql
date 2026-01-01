-- Fix profiles table security: Remove public access, allow only authenticated users
DROP POLICY IF EXISTS "Anyone can view leaderboard profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Create new policy: Only authenticated users can view profiles (for leaderboard)
CREATE POLICY "Authenticated users: view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Ensure users can still insert and update their own profiles
-- (These policies should already exist, but let's verify they're correct)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile (except premium)" ON public.profiles;

CREATE POLICY "Users: insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users: update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  AND premium_status = (SELECT premium_status FROM profiles WHERE id = auth.uid())
);

-- Fix push_notification_tokens: This table should only be accessed via service role
-- Remove any user policies and add comment explaining this is service-role only
COMMENT ON TABLE public.push_notification_tokens IS 
'Service role only table - accessed exclusively via store-push-token edge function. No user policies needed.';

-- Revoke all access from anon and authenticated roles
REVOKE ALL ON public.push_notification_tokens FROM anon;
REVOKE ALL ON public.push_notification_tokens FROM authenticated;
REVOKE ALL ON public.push_notification_tokens FROM public;