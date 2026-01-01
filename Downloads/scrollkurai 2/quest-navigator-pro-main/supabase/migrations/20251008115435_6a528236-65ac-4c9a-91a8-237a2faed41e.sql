-- Create a secure view for community posts that masks user_id for anonymous posts
CREATE OR REPLACE VIEW public.public_community_posts 
WITH (security_invoker = true)
AS
SELECT 
  id,
  CASE 
    WHEN is_anonymous = true THEN NULL
    ELSE user_id
  END as user_id,
  content,
  quest_content,
  likes_count,
  is_anonymous,
  created_at
FROM public.community_posts;

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.public_community_posts TO authenticated;
GRANT SELECT ON public.public_community_posts TO anon;

-- Create a security definer function to fetch community posts safely
CREATE OR REPLACE FUNCTION public.get_community_posts(
  limit_count integer DEFAULT 50,
  offset_count integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  content text,
  quest_content text,
  likes_count integer,
  is_anonymous boolean,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cp.id,
    CASE 
      WHEN cp.is_anonymous = true THEN NULL::uuid
      ELSE cp.user_id
    END as user_id,
    cp.content,
    cp.quest_content,
    cp.likes_count,
    cp.is_anonymous,
    cp.created_at
  FROM public.community_posts cp
  ORDER BY cp.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_community_posts(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_community_posts(integer, integer) TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_community_posts IS 'Fetches community posts with user_id masked for anonymous posts to protect user privacy';