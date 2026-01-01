-- Insights Data Pipeline Fix
-- Timezone-aware queries for Asia/Kolkata

-- 1. Get Insights Summary (daily overview)
CREATE OR REPLACE FUNCTION public.get_insights_summary(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  today_date DATE;
  week_start DATE;
  month_start DATE;
  total_xp INTEGER;
  today_xp INTEGER;
  today_quests INTEGER;
  week_xp INTEGER;
  week_quests INTEGER;
  current_streak INTEGER;
  league_rank INTEGER;
  league_tier TEXT;
  ai_usage_today INTEGER;
BEGIN
  -- Use IST timezone
  today_date := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
  week_start := today_date - EXTRACT(DOW FROM today_date)::INTEGER;
  month_start := DATE_TRUNC('month', today_date)::DATE;
  
  -- Get profile data
  SELECT xp, streak INTO total_xp, current_streak
  FROM profiles WHERE id = p_user_id;
  
  -- Today's XP (from quest log)
  SELECT COALESCE(SUM(xp_awarded), 0), COUNT(*)
  INTO today_xp, today_quests
  FROM user_quest_log
  WHERE user_id = p_user_id
    AND (completed_at AT TIME ZONE 'Asia/Kolkata')::DATE = today_date;
  
  -- This week's XP
  SELECT COALESCE(SUM(xp_awarded), 0), COUNT(*)
  INTO week_xp, week_quests
  FROM user_quest_log
  WHERE user_id = p_user_id
    AND (completed_at AT TIME ZONE 'Asia/Kolkata')::DATE >= week_start
    AND completed_at IS NOT NULL;
  
  -- League info
  SELECT ul.league_tier INTO league_tier
  FROM user_leagues ul WHERE ul.user_id = p_user_id;
  
  -- League rank (from current week's participation)
  SELECT ranked.rank INTO league_rank
  FROM (
    SELECT 
      lp.user_id,
      RANK() OVER (ORDER BY lp.xp_earned DESC) as rank
    FROM league_participations lp
    WHERE lp.week_id = get_current_league_week()
      AND lp.league_tier = league_tier
  ) ranked
  WHERE ranked.user_id = p_user_id;
  
  -- AI usage today
  SELECT COUNT(*) INTO ai_usage_today
  FROM ai_interaction_logs
  WHERE user_id = p_user_id
    AND (created_at AT TIME ZONE 'Asia/Kolkata')::DATE = today_date;
  
  result := jsonb_build_object(
    'today', jsonb_build_object(
      'xp_earned', COALESCE(today_xp, 0),
      'quests_completed', COALESCE(today_quests, 0),
      'ai_interactions', COALESCE(ai_usage_today, 0)
    ),
    'week', jsonb_build_object(
      'xp_earned', COALESCE(week_xp, 0),
      'quests_completed', COALESCE(week_quests, 0)
    ),
    'overall', jsonb_build_object(
      'total_xp', COALESCE(total_xp, 0),
      'current_streak', COALESCE(current_streak, 0),
      'league_tier', COALESCE(league_tier, 'bronze'),
      'league_rank', league_rank
    )
  );
  
  RETURN result;
END;
$$;

-- 2. Get Weekly Insights (day-by-day breakdown)
CREATE OR REPLACE FUNCTION public.get_weekly_insights(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
  day_date DATE,
  day_name TEXT,
  xp_earned INTEGER,
  quests_completed INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_date DATE;
  week_start DATE;
BEGIN
  today_date := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
  week_start := today_date - EXTRACT(DOW FROM today_date)::INTEGER;
  
  RETURN QUERY
  SELECT 
    d.day_date,
    TO_CHAR(d.day_date, 'Dy') as day_name,
    COALESCE(SUM(uql.xp_awarded)::INTEGER, 0) as xp_earned,
    COUNT(uql.id)::INTEGER as quests_completed
  FROM generate_series(week_start, today_date, '1 day'::interval) AS d(day_date)
  LEFT JOIN user_quest_log uql 
    ON uql.user_id = p_user_id
    AND (uql.completed_at AT TIME ZONE 'Asia/Kolkata')::DATE = d.day_date
    AND uql.completed_at IS NOT NULL
  GROUP BY d.day_date
  ORDER BY d.day_date;
END;
$$;

-- 3. Get Streak History
CREATE OR REPLACE FUNCTION public.get_streak_history(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
  quest_date DATE,
  completed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_date DATE;
  start_date DATE;
BEGIN
  today_date := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
  start_date := today_date - 30; -- Last 30 days
  
  RETURN QUERY
  SELECT 
    d.quest_date::DATE,
    EXISTS (
      SELECT 1 FROM user_quest_log uql
      WHERE uql.user_id = p_user_id
        AND (uql.completed_at AT TIME ZONE 'Asia/Kolkata')::DATE = d.quest_date
        AND uql.completed_at IS NOT NULL
    ) as completed
  FROM generate_series(start_date, today_date, '1 day'::interval) AS d(quest_date)
  ORDER BY d.quest_date DESC;
END;
$$;

-- 4. Get Power-Ups Usage Stats
CREATE OR REPLACE FUNCTION public.get_powerup_usage_stats(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  total_used INTEGER;
  xp_boosters_used INTEGER;
  streak_freezes_used INTEGER;
  current_xp_booster BOOLEAN;
  current_streak_freeze BOOLEAN;
BEGIN
  -- Get profile for active power-ups
  SELECT 
    xp_booster_active,
    streak_freeze_active
  INTO current_xp_booster, current_streak_freeze
  FROM profiles WHERE id = p_user_id;
  
  -- Count power-up purchases/usage (simplified - you may have a more detailed table)
  SELECT COUNT(*) INTO total_used
  FROM power_up_purchases WHERE user_id = p_user_id;
  
  result := jsonb_build_object(
    'total_used', COALESCE(total_used, 0),
    'xp_booster_active', COALESCE(current_xp_booster, FALSE),
    'streak_freeze_active', COALESCE(current_streak_freeze, FALSE)
  );
  
  RETURN result;
END;
$$;

-- 5. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_insights_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekly_insights TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_streak_history TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_powerup_usage_stats TO authenticated;
