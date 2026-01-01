-- Fix 1: Add challenge_type to differentiate Solo, Duo, Team challenges
ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS challenge_type TEXT NOT NULL DEFAULT 'solo'
CHECK (challenge_type IN ('solo', 'duo', 'team'));

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_challenges_type ON public.challenges(challenge_type);

-- Fix 2: Create team_invites table for invite system
CREATE TABLE IF NOT EXISTS public.team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL,
  invitee_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(team_id, invitee_id)
);

-- Enable RLS on team_invites
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view invites sent to them or from their teams
CREATE POLICY "Users can view relevant invites"
ON public.team_invites
FOR SELECT
USING (
  auth.uid() = invitee_id 
  OR 
  team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  )
);

-- RLS: Team members can send invites
CREATE POLICY "Team members can send invites"
ON public.team_invites
FOR INSERT
WITH CHECK (
  auth.uid() = inviter_id
  AND
  team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  )
);

-- RLS: Invitees can update their invite status
CREATE POLICY "Invitees can respond to invites"
ON public.team_invites
FOR UPDATE
USING (auth.uid() = invitee_id);

-- Fix 3: Add duo_partner_id for Duo challenges
ALTER TABLE public.challenge_participants
ADD COLUMN IF NOT EXISTS duo_partner_id UUID;

-- Fix 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_invites_invitee ON public.team_invites(invitee_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_team ON public.team_invites(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_status ON public.team_invites(status);