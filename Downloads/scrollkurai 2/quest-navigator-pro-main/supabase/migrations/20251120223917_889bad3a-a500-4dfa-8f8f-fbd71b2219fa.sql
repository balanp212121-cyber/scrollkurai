-- Fix referrals table RLS policies to prevent abuse

-- Remove overly permissive policies
DROP POLICY IF EXISTS "Anyone can insert referrals" ON referrals;
DROP POLICY IF EXISTS "System can update referral status" ON referrals;

-- Create restricted insertion policy
-- Only allow users to be referred (insert where they are the referred_id)
CREATE POLICY "Users can be referred"
ON referrals FOR INSERT
TO authenticated
WITH CHECK (
  -- Only allow inserting where current user is the referred_id
  auth.uid() = referred_id
  -- Referrer must exist and code must be valid
  AND EXISTS (
    SELECT 1 FROM referral_codes
    WHERE referral_codes.code = referral_code
    AND referral_codes.user_id = referrer_id
  )
);

-- Create service role only update policy
-- This ensures only edge functions with service role can update referral status
CREATE POLICY "Service role can update referrals"
ON referrals FOR UPDATE
TO service_role
USING (true);

-- Fix community_posts RLS policy to prevent likes count manipulation

-- Remove overly permissive update policy
DROP POLICY IF EXISTS "Users can update post likes count" ON community_posts;

-- Create restricted update policy - users can only update their own posts
-- and cannot directly modify likes_count (it's managed by database functions)
CREATE POLICY "Users can update own posts content"
ON community_posts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id 
  -- Ensure likes_count hasn't been modified
  AND likes_count = (
    SELECT likes_count FROM community_posts AS cp WHERE cp.id = community_posts.id
  )
);