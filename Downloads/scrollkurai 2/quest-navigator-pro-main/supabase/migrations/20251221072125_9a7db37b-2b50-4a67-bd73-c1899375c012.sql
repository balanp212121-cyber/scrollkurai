-- Add reward columns to challenges table
ALTER TABLE public.challenges 
ADD COLUMN IF NOT EXISTS reward_xp INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reward_badge_id UUID REFERENCES public.badges(id);

-- Create table to track challenge reward history (prevent double rewards)
CREATE TABLE IF NOT EXISTS public.challenge_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  xp_awarded INTEGER DEFAULT 0,
  badge_awarded UUID REFERENCES public.badges(id),
  awarded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, challenge_id)
);

-- Enable RLS
ALTER TABLE public.challenge_rewards ENABLE ROW LEVEL SECURITY;

-- Users can view their own rewards
CREATE POLICY "Users can view their own challenge rewards"
ON public.challenge_rewards
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only system can insert rewards (via service role)
CREATE POLICY "System can insert challenge rewards"
ON public.challenge_rewards
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Add reward columns to team_challenges as well
ALTER TABLE public.team_challenges 
ADD COLUMN IF NOT EXISTS reward_xp INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reward_badge_id UUID REFERENCES public.badges(id);