-- Drop existing SELECT policies on challenge_participants
DROP POLICY IF EXISTS "Users can view challenge participants" ON public.challenge_participants;
DROP POLICY IF EXISTS "Anyone can view challenge participants" ON public.challenge_participants;
DROP POLICY IF EXISTS "Authenticated users can view challenge participants" ON public.challenge_participants;
DROP POLICY IF EXISTS "Users can view their own participation" ON public.challenge_participants;

-- Create new policy: Only admins can view all challenge participants
CREATE POLICY "Admins can view all challenge participants"
ON public.challenge_participants
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow users to view only their own participation (for progress tracking)
CREATE POLICY "Users can view their own participation"
ON public.challenge_participants
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);