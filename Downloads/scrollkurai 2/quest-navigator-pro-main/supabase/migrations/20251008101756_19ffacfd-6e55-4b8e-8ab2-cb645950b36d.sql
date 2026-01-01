-- Fix profiles table security
DROP POLICY IF EXISTS "Anyone can view leaderboard profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users: view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users: insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile (except premium)" ON public.profiles;
DROP POLICY IF EXISTS "Users: update own profile" ON public.profiles;

-- Create clean set of policies
CREATE POLICY "authenticated_view_profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_insert_own"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "authenticated_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  AND premium_status = (SELECT premium_status FROM profiles WHERE id = auth.uid())
);

-- Secure push_notification_tokens table
COMMENT ON TABLE public.push_notification_tokens IS 
'Service role only - accessed via store-push-token edge function';

REVOKE ALL ON public.push_notification_tokens FROM anon;
REVOKE ALL ON public.push_notification_tokens FROM authenticated;
REVOKE ALL ON public.push_notification_tokens FROM public;