-- Add RLS policy for authenticated users to lookup referral codes by code value
-- This is needed for the signup flow to find referrers
CREATE POLICY "Authenticated users can lookup referral codes by code"
ON public.referral_codes
FOR SELECT
TO authenticated
USING (true);

-- Add permissive SELECT policy for quests table so we can use regular client
-- This removes the need for service role bypass in get-daily-quest
CREATE POLICY "Authenticated users can view all quests"
ON public.quests
FOR SELECT
TO authenticated
USING (true);