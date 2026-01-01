-- Add RLS policies for push_notification_tokens table
-- Users can view their own tokens
CREATE POLICY "users_view_own_tokens"
ON public.push_notification_tokens
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own tokens
CREATE POLICY "users_insert_own_tokens"
ON public.push_notification_tokens
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own tokens
CREATE POLICY "users_update_own_tokens"
ON public.push_notification_tokens
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own tokens
CREATE POLICY "users_delete_own_tokens"
ON public.push_notification_tokens
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);