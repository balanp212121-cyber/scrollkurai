-- Drop the existing INSERT policy on challenges if it exists
DROP POLICY IF EXISTS "Users can create challenges" ON public.challenges;
DROP POLICY IF EXISTS "Anyone can create public challenges" ON public.challenges;
DROP POLICY IF EXISTS "Authenticated users can create challenges" ON public.challenges;

-- Create new policy: Only admins can create challenges
CREATE POLICY "Only admins can create challenges" 
ON public.challenges 
FOR INSERT 
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Ensure admins can also update and delete challenges they created
DROP POLICY IF EXISTS "Users can update their own challenges" ON public.challenges;
DROP POLICY IF EXISTS "Admins can update challenges" ON public.challenges;

CREATE POLICY "Admins can update challenges" 
ON public.challenges 
FOR UPDATE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can delete their own challenges" ON public.challenges;
DROP POLICY IF EXISTS "Admins can delete challenges" ON public.challenges;

CREATE POLICY "Admins can delete challenges" 
ON public.challenges 
FOR DELETE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));