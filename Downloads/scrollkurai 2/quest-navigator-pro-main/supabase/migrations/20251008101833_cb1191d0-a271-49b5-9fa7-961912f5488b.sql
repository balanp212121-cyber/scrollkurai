-- Remove the public policy that exposes profiles to unauthenticated users
DROP POLICY IF EXISTS "Anyone can view leaderboard profiles" ON public.profiles;

-- Ensure push_notification_tokens is service-role only
COMMENT ON TABLE public.push_notification_tokens IS 
'Service role only - accessed via store-push-token edge function';

REVOKE ALL ON public.push_notification_tokens FROM anon;
REVOKE ALL ON public.push_notification_tokens FROM authenticated;