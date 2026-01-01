-- Fix profiles table security - restrict to authenticated users only
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Only authenticated users can view profiles (for leaderboard)
CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Add explicit policy for push_notification_tokens (service role only)
-- No SELECT policy = only service role can access
COMMENT ON TABLE public.push_notification_tokens IS 'Push tokens accessible only via service role. No client access permitted.';