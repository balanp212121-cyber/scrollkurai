-- Allow users to join teams when they have a pending invite
CREATE POLICY "Users can join teams via invite acceptance"
ON public.team_members
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM public.team_invites 
    WHERE team_invites.team_id = team_members.team_id 
    AND team_invites.invitee_id = auth.uid() 
    AND team_invites.status = 'pending'
  )
);