-- Fix League Ranking, Challenge Permissions

-- PART 1: Fix get_league_leaderboard to compute rank dynamically
CREATE OR REPLACE FUNCTION public.get_league_leaderboard(
  league_tier_param league_tier,
  week_id_param UUID DEFAULT NULL
)
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  xp_earned INTEGER,
  rank INTEGER,
  league_tier league_tier
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_week_id UUID;
BEGIN
  -- Use provided week or get current week
  target_week_id := COALESCE(week_id_param, get_current_league_week());
  
  RETURN QUERY
  SELECT 
    lp.user_id,
    p.username,
    lp.xp_earned,
    CAST(RANK() OVER (ORDER BY lp.xp_earned DESC) AS INTEGER) as rank,
    lp.league_tier
  FROM league_participations lp
  JOIN profiles p ON p.id = lp.user_id
  WHERE lp.league_tier = league_tier_param
    AND lp.week_id = target_week_id
  ORDER BY lp.xp_earned DESC, lp.created_at ASC;
END;
$$;

-- PART 2: RPC for challenge creation (admin-only)
CREATE OR REPLACE FUNCTION public.create_challenge_admin(
  p_title TEXT,
  p_description TEXT,
  p_challenge_type TEXT,
  p_target_type TEXT,
  p_target_value INTEGER,
  p_duration_days INTEGER DEFAULT 7,
  p_max_participants INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_challenge_id UUID;
  is_admin BOOLEAN;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check admin role
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = current_user_id AND role = 'admin'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Admin access required to create challenges';
  END IF;

  -- Create challenge
  INSERT INTO challenges (
    title,
    description,
    challenge_type,
    target_type,
    target_value,
    duration_days,
    max_participants,
    created_by,
    starts_at,
    ends_at
  ) VALUES (
    p_title,
    p_description,
    p_challenge_type,
    p_target_type,
    p_target_value,
    p_duration_days,
    p_max_participants,
    current_user_id,
    NOW(),
    NOW() + (p_duration_days || ' days')::INTERVAL
  )
  RETURNING id INTO new_challenge_id;

  RETURN new_challenge_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PART 3: RPC for getting challenge participants (admin sees all, users see count only)
CREATE OR REPLACE FUNCTION public.get_challenge_participants(
  p_challenge_id UUID
)
RETURNS TABLE(
  participant_id UUID,
  user_id UUID,
  username TEXT,
  current_progress INTEGER,
  completed BOOLEAN,
  joined_at TIMESTAMPTZ,
  is_current_user BOOLEAN,
  participant_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  is_admin BOOLEAN;
  total_count INTEGER;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check if admin
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = current_user_id AND role = 'admin'
  ) INTO is_admin;

  -- Get total count
  SELECT COUNT(*)::INTEGER INTO total_count
  FROM challenge_participants
  WHERE challenge_id = p_challenge_id;

  IF is_admin THEN
    -- Admin sees all participants
    RETURN QUERY
    SELECT 
      cp.id as participant_id,
      cp.user_id,
      p.username,
      cp.current_progress,
      cp.completed,
      cp.joined_at,
      (cp.user_id = current_user_id) as is_current_user,
      total_count as participant_count
    FROM challenge_participants cp
    JOIN profiles p ON p.id = cp.user_id
    WHERE cp.challenge_id = p_challenge_id
    ORDER BY cp.current_progress DESC;
  ELSE
    -- Non-admin sees only their own + count
    RETURN QUERY
    SELECT 
      cp.id as participant_id,
      cp.user_id,
      p.username,
      cp.current_progress,
      cp.completed,
      cp.joined_at,
      TRUE as is_current_user,
      total_count as participant_count
    FROM challenge_participants cp
    JOIN profiles p ON p.id = cp.user_id
    WHERE cp.challenge_id = p_challenge_id
      AND cp.user_id = current_user_id;
  END IF;
END;
$$;
