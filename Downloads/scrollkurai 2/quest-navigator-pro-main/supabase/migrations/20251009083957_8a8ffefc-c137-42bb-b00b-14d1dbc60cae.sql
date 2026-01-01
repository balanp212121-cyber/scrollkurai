-- Create function to search users by username (bypasses RLS with SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.search_users_by_username(search_term text)
RETURNS TABLE(id uuid, username text, level integer, xp integer, streak integer, archetype text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.level,
    p.xp,
    p.streak,
    p.archetype
  FROM public.profiles p
  WHERE p.username ILIKE search_term || '%'
  LIMIT 10;
END;
$$;

-- Create function to get friend profiles by IDs (bypasses RLS with SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_profiles_by_ids(user_ids uuid[])
RETURNS TABLE(id uuid, username text, level integer, xp integer, streak integer, archetype text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.level,
    p.xp,
    p.streak,
    p.archetype
  FROM public.profiles p
  WHERE p.id = ANY(user_ids);
END;
$$;