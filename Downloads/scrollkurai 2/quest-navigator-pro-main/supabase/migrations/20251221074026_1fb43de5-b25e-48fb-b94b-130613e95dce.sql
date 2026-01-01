-- Create a function for admins to get all profiles by IDs (bypasses friend restrictions)
CREATE OR REPLACE FUNCTION public.get_profiles_by_ids_admin(user_ids uuid[])
RETURNS TABLE (
  id uuid,
  username text,
  level integer,
  xp integer,
  streak integer,
  archetype text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the calling user is an admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
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