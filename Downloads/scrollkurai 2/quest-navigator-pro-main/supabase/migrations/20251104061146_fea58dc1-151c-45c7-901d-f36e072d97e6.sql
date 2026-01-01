-- Fix SECURITY DEFINER Functions to Add Authorization Checks

-- 1. Drop and recreate search_users_by_username to return only limited data
DROP FUNCTION IF EXISTS public.search_users_by_username(text);

CREATE FUNCTION public.search_users_by_username(search_term text)
RETURNS TABLE(id uuid, username text, level integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only return limited data for user search (no XP, streak, archetype)
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.level
  FROM public.profiles p
  WHERE p.username ILIKE search_term || '%'
  LIMIT 10;
END;
$$;

-- 2. Drop and recreate get_profiles_by_ids to restrict to friends only
DROP FUNCTION IF EXISTS public.get_profiles_by_ids(uuid[]);

CREATE FUNCTION public.get_profiles_by_ids(user_ids uuid[])
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
  WHERE p.id = ANY(user_ids)
    AND (
      -- User can view their own profile
      p.id = auth.uid() 
      OR 
      -- Or profiles of accepted friends
      p.id IN (
        SELECT friend_id FROM friends 
        WHERE user_id = auth.uid() AND status = 'accepted'
        UNION
        SELECT user_id FROM friends 
        WHERE friend_id = auth.uid() AND status = 'accepted'
      )
    );
END;
$$;

-- 3. Revoke public access to set_premium_status function
-- Only service role (edge functions) should be able to call this
REVOKE EXECUTE ON FUNCTION public.set_premium_status(uuid, boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_premium_status(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_premium_status(uuid, boolean) FROM public;