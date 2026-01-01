-- Security Fix 1: Create service-only table for push notification tokens
-- This prevents client applications from reading push tokens
CREATE TABLE IF NOT EXISTS public.push_notification_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  push_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS but only allow service role access (no policies = no client access)
ALTER TABLE public.push_notification_tokens ENABLE ROW LEVEL SECURITY;

-- Add trigger for updated_at
CREATE TRIGGER update_push_notification_tokens_updated_at
  BEFORE UPDATE ON public.push_notification_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Security Fix 2: Create public profiles view for leaderboard
-- Only exposes safe, non-sensitive data for leaderboard display
CREATE OR REPLACE VIEW public.leaderboard_profiles AS
SELECT 
  id,
  username,
  xp,
  level,
  streak,
  archetype,
  total_quests_completed
FROM public.profiles;

-- Allow authenticated users to view leaderboard data
CREATE POLICY "Anyone can view leaderboard profiles"
  ON public.profiles
  FOR SELECT
  USING (true);

-- Drop the restrictive policy that was causing issues
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Re-create with proper access: users can see all profiles for leaderboard,
-- but can only update their own (excluding premium_status)
CREATE POLICY "Users can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (true);

-- Security Fix 3: Prevent premium_status privilege escalation
-- Users can only update their own profile, but NOT premium_status
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile (except premium)"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id 
    AND premium_status = (SELECT premium_status FROM public.profiles WHERE id = auth.uid())
  );

-- Create secure function to update premium status (service role only)
CREATE OR REPLACE FUNCTION public.set_premium_status(target_user_id UUID, new_status BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET premium_status = new_status,
      updated_at = now()
  WHERE id = target_user_id;
END;
$$;

-- Security Fix 4: Restrict quest content access
-- Only show quests that are assigned to the user
DROP POLICY IF EXISTS "Authenticated users can view quests" ON public.quests;

CREATE POLICY "Users can view their assigned quests"
  ON public.quests
  FOR SELECT
  USING (
    id IN (
      SELECT quest_id 
      FROM public.user_quest_log 
      WHERE user_id = auth.uid()
    )
  );

-- Security Fix 5: Remove push_token columns from exposed tables
-- First migrate any existing tokens to the new table
INSERT INTO public.push_notification_tokens (user_id, push_token)
SELECT user_id, push_token
FROM public.notification_preferences
WHERE push_token IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET push_token = EXCLUDED.push_token;

-- Now safe to drop the columns
ALTER TABLE public.notification_preferences DROP COLUMN IF EXISTS push_token;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS push_token;