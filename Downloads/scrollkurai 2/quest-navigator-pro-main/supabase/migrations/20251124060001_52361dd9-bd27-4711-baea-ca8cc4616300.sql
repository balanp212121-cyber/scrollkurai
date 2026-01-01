-- Update teams RLS policy to allow viewing teams with pending invites
DROP POLICY IF EXISTS "Users can view teams they are members of or created" ON public.teams;

CREATE POLICY "Users can view teams they are members of or created or invited to"
ON public.teams
FOR SELECT
USING (
  creator_id = auth.uid() 
  OR is_team_member(auth.uid(), id)
  OR EXISTS (
    SELECT 1 FROM public.team_invites
    WHERE team_invites.team_id = teams.id
    AND team_invites.invitee_id = auth.uid()
    AND team_invites.status = 'pending'
  )
);