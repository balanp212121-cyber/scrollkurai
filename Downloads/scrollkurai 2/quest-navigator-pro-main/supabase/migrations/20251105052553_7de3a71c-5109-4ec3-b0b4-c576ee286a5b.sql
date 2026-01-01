-- Fix Security Issues: Warn-Level Findings (Corrected)

-- 1. Add server-side validation for community posts content (drop existing first)
ALTER TABLE community_posts DROP CONSTRAINT IF EXISTS content_length_check;
ALTER TABLE community_posts DROP CONSTRAINT IF EXISTS quest_content_length_check;

ALTER TABLE community_posts 
ADD CONSTRAINT content_length_check 
CHECK (length(content) >= 10 AND length(content) <= 5000);

ALTER TABLE community_posts 
ADD CONSTRAINT quest_content_length_check 
CHECK (quest_content IS NULL OR length(quest_content) <= 500);

-- 2. Fix profiles table RLS - restrict to owner only (not publicly readable)
DROP POLICY IF EXISTS "Anyone can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "users_view_own_profile" ON public.profiles;

CREATE POLICY "users_view_own_profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- 3. Add server-side XP check for username changes
DROP POLICY IF EXISTS "authenticated_update_own" ON public.profiles;

CREATE POLICY "authenticated_update_own"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  AND premium_status = (SELECT premium_status FROM profiles WHERE id = auth.uid())
  AND (
    -- If username is being changed, must have 1000+ XP
    username = (SELECT username FROM profiles WHERE id = auth.uid())
    OR xp >= 1000
  )
);

-- 4. Fix public_community_posts view to properly mask anonymous user_ids
DROP VIEW IF EXISTS public_community_posts;

CREATE VIEW public_community_posts AS
SELECT 
  id,
  CASE WHEN is_anonymous THEN NULL ELSE user_id END as user_id,
  content,
  quest_content,
  likes_count,
  is_anonymous,
  created_at
FROM community_posts;

-- Set security_invoker to ensure RLS is applied
ALTER VIEW public_community_posts SET (security_invoker = true);

-- Grant access to authenticated users
GRANT SELECT ON public_community_posts TO authenticated;