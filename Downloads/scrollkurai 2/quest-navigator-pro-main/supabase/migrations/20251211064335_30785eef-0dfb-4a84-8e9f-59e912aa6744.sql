
-- Add policy for users to update their own league participation records
CREATE POLICY "Users can update their own participation"
ON public.league_participations
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
