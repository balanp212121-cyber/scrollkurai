-- Create function to get profiles for team members (bypasses RLS for team context)
CREATE OR REPLACE FUNCTION public.get_team_member_profiles(team_id_param uuid)
RETURNS TABLE(
  user_id uuid,
  username text,
  level integer,
  premium_status boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    p.premium_status
  FROM public.profiles p
  INNER JOIN public.team_members tm ON tm.user_id = p.id
  WHERE tm.team_id = team_id_param;
END;
$$;