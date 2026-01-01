-- Fix infinite recursion in team_members SELECT policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view team members of their teams" ON public.team_members;

-- Create new policy using the security definer function to avoid recursion
CREATE POLICY "Users can view team members of their teams"
ON public.team_members
FOR SELECT
USING (
  is_team_member(auth.uid(), team_id)
  OR 
  team_id IN (SELECT id FROM teams WHERE creator_id = auth.uid())
);