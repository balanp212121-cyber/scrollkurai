
-- Update get_profiles_by_ids to include profiles of users with pending friend requests
CREATE OR REPLACE FUNCTION public.get_profiles_by_ids(user_ids uuid[])
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
      OR
      -- Or profiles of users with pending friend requests (sent or received)
      p.id IN (
        SELECT friend_id FROM friends 
        WHERE user_id = auth.uid() AND status = 'pending'
        UNION
        SELECT user_id FROM friends 
        WHERE friend_id = auth.uid() AND status = 'pending'
      )
    );
END;
$$;
