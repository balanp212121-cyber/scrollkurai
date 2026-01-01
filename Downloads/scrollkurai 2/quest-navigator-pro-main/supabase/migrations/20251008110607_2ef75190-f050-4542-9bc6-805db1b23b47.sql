-- Drop the view since it won't work with RLS
DROP VIEW IF EXISTS public.public_profiles;

-- Create a security definer function that returns only public profile data for leaderboards
CREATE OR REPLACE FUNCTION public.get_public_profiles(
  order_by text DEFAULT 'xp',
  limit_count integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  username text,
  xp integer,
  level integer,
  streak integer,
  archetype text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.xp,
    p.level,
    p.streak,
    p.archetype
  FROM public.profiles p
  ORDER BY 
    CASE 
      WHEN order_by = 'xp' THEN p.xp
      WHEN order_by = 'level' THEN p.level
      WHEN order_by = 'streak' THEN p.streak
      ELSE p.xp
    END DESC
  LIMIT limit_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_public_profiles TO authenticated;