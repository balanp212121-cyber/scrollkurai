-- Fix payment_transactions RLS for admins
-- Admins need to update status to 'rejected' or 'completed'
DROP POLICY IF EXISTS "Admins can update payment transactions" ON public.payment_transactions;
CREATE POLICY "Admins can update payment transactions"
ON public.payment_transactions
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Fix community_posts RLS for admins
-- Admins need to insert rejection notifications on behalf of users (or targeted at them)
DROP POLICY IF EXISTS "Admins can insert community posts" ON public.community_posts;
CREATE POLICY "Admins can insert community posts"
ON public.community_posts
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix payment_proofs RLS for admins
-- Admins need to update proof status
DROP POLICY IF EXISTS "Admins can update payment proofs" ON public.payment_proofs;
CREATE POLICY "Admins can update payment proofs"
ON public.payment_proofs
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Also ensure admins can SELECT payment_proofs (likely already exists, but ensuring)
DROP POLICY IF EXISTS "Admins can view all payment proofs" ON public.payment_proofs;
CREATE POLICY "Admins can view all payment proofs"
ON public.payment_proofs
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));
