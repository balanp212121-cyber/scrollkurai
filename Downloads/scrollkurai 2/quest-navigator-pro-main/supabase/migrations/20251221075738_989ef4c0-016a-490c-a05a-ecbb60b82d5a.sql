-- Add admin policy for managing subscriptions (upsert/update)
CREATE POLICY "Admins can manage all subscriptions" 
ON public.subscriptions 
FOR ALL
TO public
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Add admin policy for inserting subscriptions on behalf of users
CREATE POLICY "Service role can manage subscriptions" 
ON public.subscriptions 
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);