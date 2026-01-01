-- Allow users to update likes_count in community_posts
CREATE POLICY "Users can update post likes count"
ON public.community_posts
FOR UPDATE
USING (true)
WITH CHECK (true);