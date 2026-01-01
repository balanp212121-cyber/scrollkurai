-- Add DELETE policy for friends table
CREATE POLICY "Users can delete their own friend records"
ON public.friends
FOR DELETE
USING (auth.uid() = user_id OR auth.uid() = friend_id);