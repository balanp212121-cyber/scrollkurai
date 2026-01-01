-- Add baseline columns to track starting values when user joins challenge
ALTER TABLE public.challenge_participants
ADD COLUMN IF NOT EXISTS baseline_quests integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS baseline_xp integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS baseline_streak integer DEFAULT 0;

-- Add baseline columns to team_challenge_progress
ALTER TABLE public.team_challenge_progress
ADD COLUMN IF NOT EXISTS baseline_data jsonb DEFAULT '{}';

COMMENT ON COLUMN public.challenge_participants.baseline_quests IS 'Quests completed when user joined the challenge';
COMMENT ON COLUMN public.challenge_participants.baseline_xp IS 'XP when user joined the challenge';
COMMENT ON COLUMN public.challenge_participants.baseline_streak IS 'Streak when user joined the challenge';