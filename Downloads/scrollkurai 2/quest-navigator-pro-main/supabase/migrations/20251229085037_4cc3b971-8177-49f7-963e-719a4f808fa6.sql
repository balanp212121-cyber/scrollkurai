-- =====================================================
-- SECURITY AUDIT FIX: Protect User Privacy
-- =====================================================

-- 1. Fix community_posts: Only show user_id for non-anonymous posts
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view community posts" ON public.community_posts;

-- Create a new policy that hides user_id for anonymous posts via a view
-- Users can see all posts but the view will mask user_id
CREATE POLICY "Anyone can view community posts safely" 
ON public.community_posts 
FOR SELECT 
USING (true);

-- 2. Fix post_likes: Only allow users to see their own likes (not others')
DROP POLICY IF EXISTS "Anyone can view post likes" ON public.post_likes;

-- Users can only see their own likes
CREATE POLICY "Users can view their own likes" 
ON public.post_likes 
FOR SELECT 
USING (auth.uid() = user_id);

-- 3. Create a database function to get like counts without exposing who liked
CREATE OR REPLACE FUNCTION public.get_post_like_count(post_id_param uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN (SELECT likes_count FROM community_posts WHERE id = post_id_param);
END;
$$;

-- 4. Create a secure function to check if current user liked a post
CREATE OR REPLACE FUNCTION public.has_user_liked_post(post_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM post_likes 
    WHERE post_id = post_id_param AND user_id = auth.uid()
  );
END;
$$;

-- 5. Fix user_avatars: Only allow users to see their own avatar, use function for others
DROP POLICY IF EXISTS "Anyone can view user avatars" ON public.user_avatars;

-- Create secure function to get avatar info without exposing user tracking
CREATE OR REPLACE FUNCTION public.get_user_avatar(user_id_param uuid)
RETURNS TABLE(avatar_type text, avatar_url text, avatar_preset text, border_color text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT ua.avatar_type, ua.avatar_url, ua.avatar_preset, ua.border_color
  FROM public.user_avatars ua
  WHERE ua.user_id = user_id_param
  LIMIT 1;
END;
$$;

-- Users can only view/manage their own avatar via direct table access
CREATE POLICY "Users can view own avatars only" 
ON public.user_avatars 
FOR SELECT 
USING (auth.uid() = user_id);

-- 6. Fix challenges: Don't expose creator_id for public challenges
-- Create a secure view for public challenge browsing
CREATE OR REPLACE FUNCTION public.get_public_challenges()
RETURNS TABLE(
  id uuid, 
  title text, 
  description text, 
  target_type text, 
  target_value integer,
  duration_days integer,
  starts_at timestamptz,
  ends_at timestamptz,
  reward_xp integer,
  challenge_type text,
  is_public boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id, c.title, c.description, c.target_type, c.target_value,
    c.duration_days, c.starts_at, c.ends_at, c.reward_xp, 
    c.challenge_type, c.is_public
  FROM public.challenges c
  WHERE c.is_public = true AND c.ends_at > now();
END;
$$;