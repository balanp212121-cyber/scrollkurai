-- Drop the existing function first
DROP FUNCTION IF EXISTS public.get_team_member_profiles(uuid);

-- Recreate with full profile data
CREATE FUNCTION public.get_team_member_profiles(team_id_param uuid)
RETURNS TABLE(
  user_id uuid, 
  username text, 
  level integer, 
  premium_status boolean,
  xp integer,
  streak integer,
  archetype text,
  total_quests_completed integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only return profiles if the requesting user is a member of the team
  IF NOT is_team_member(auth.uid(), team_id_param) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.username,
    p.level,
    p.premium_status,
    p.xp,
    p.streak,
    p.archetype,
    p.total_quests_completed
  FROM public.profiles p
  INNER JOIN public.team_members tm ON tm.user_id = p.id
  WHERE tm.team_id = team_id_param;
END;
$$;