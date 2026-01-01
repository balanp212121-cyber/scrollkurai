-- Allow team creators to delete their teams
CREATE POLICY "Team creators can delete their teams"
ON public.teams
FOR DELETE
USING (auth.uid() = creator_id);

-- Allow cascade delete of team members when team is deleted
CREATE POLICY "Team members deleted with team"
ON public.team_members
FOR DELETE
USING (
  team_id IN (SELECT id FROM teams WHERE creator_id = auth.uid())
  OR user_id = auth.uid()
);