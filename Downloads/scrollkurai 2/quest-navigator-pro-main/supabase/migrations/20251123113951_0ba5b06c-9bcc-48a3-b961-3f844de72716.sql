-- Fix team creation: allow creators to view their newly created teams
-- before team_members record is inserted
DROP POLICY IF EXISTS "Users can view teams they are members of" ON teams;

CREATE POLICY "Users can view teams they are members of or created"
ON teams
FOR SELECT
TO authenticated
USING (
  creator_id = auth.uid() 
  OR public.is_team_member(auth.uid(), id)
);