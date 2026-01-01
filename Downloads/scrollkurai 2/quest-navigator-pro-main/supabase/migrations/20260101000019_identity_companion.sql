-- Identity-Driven Discipline Companion
-- Phase 1: Identity Classes + Phase 4: Social Gravity + Phase 5: Insights

-- 1. Identity Classes Table
CREATE TABLE IF NOT EXISTS public.identity_classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  description TEXT NOT NULL,
  philosophy TEXT NOT NULL,
  color TEXT NOT NULL, -- Hex color for theming
  quest_themes TEXT[] -- Types of quests this class excels at
);

-- Seed Identity Classes
INSERT INTO public.identity_classes (id, name, icon, description, philosophy, color, quest_themes) VALUES
('mind_warrior', 'Mind Warrior', '🧠', 'Master of mental discipline', 'Strength through clarity. Control through thought.', '#6366f1', ARRAY['focus', 'meditation', 'learning']),
('focus_assassin', 'Focus Assassin', '⚡', 'Precision in every action', 'Strike fast. Strike true. No distractions.', '#f59e0b', ARRAY['deep_work', 'time_blocking', 'elimination']),
('discipline_monk', 'Discipline Monk', '🔥', 'Unwavering daily practice', 'Consistency is mastery. Repetition is wisdom.', '#ef4444', ARRAY['routine', 'habit', 'ritual']),
('calm_strategist', 'Calm Strategist', '👑', 'Patience and long-term vision', 'See the whole board. Move with purpose.', '#10b981', ARRAY['planning', 'reflection', 'growth'])
ON CONFLICT (id) DO NOTHING;

-- 2. Add identity_class to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS identity_class TEXT REFERENCES public.identity_classes(id);

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS identity_class_changed_at TIMESTAMPTZ;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS identity_locked_until TIMESTAMPTZ; -- 30-day cooldown

-- 3. Add reliability_score to team_members
ALTER TABLE public.team_members
ADD COLUMN IF NOT EXISTS reliability_score INTEGER DEFAULT 50 CHECK (reliability_score >= 0 AND reliability_score <= 100);

ALTER TABLE public.team_members
ADD COLUMN IF NOT EXISTS quests_completed INTEGER DEFAULT 0;

ALTER TABLE public.team_members
ADD COLUMN IF NOT EXISTS quests_missed INTEGER DEFAULT 0;

-- 4. Team Streak Shields
CREATE TABLE IF NOT EXISTS public.team_streak_shields (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id),
  week_start DATE NOT NULL,
  used_for_user_id UUID REFERENCES auth.users(id),
  used_at TIMESTAMPTZ,
  UNIQUE(team_id, week_start)
);

-- 5. Ritual Moments Table
CREATE TABLE IF NOT EXISTS public.ritual_moments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  moment_type TEXT NOT NULL, -- 'first_quest', 'streak_7', 'streak_30', 'rare_drop', 'weekly_recap'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  seen_at TIMESTAMPTZ
);

-- 6. RPC: Choose Identity Class
CREATE OR REPLACE FUNCTION public.choose_identity_class(p_class_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id UUID;
  current_level INTEGER;
  current_class TEXT;
  locked_until TIMESTAMPTZ;
BEGIN
  user_id := auth.uid();
  
  -- Get current profile
  SELECT level, identity_class, identity_locked_until
  INTO current_level, current_class, locked_until
  FROM profiles WHERE id = user_id;
  
  -- Must be Level 5+
  IF current_level < 5 THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'Reach Level 5 to unlock identity classes');
  END IF;
  
  -- Check 30-day cooldown
  IF locked_until IS NOT NULL AND locked_until > NOW() THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'Can only change identity once every 30 days',
      'locked_until', locked_until);
  END IF;
  
  -- Validate class exists
  IF NOT EXISTS (SELECT 1 FROM identity_classes WHERE id = p_class_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'Invalid identity class');
  END IF;
  
  -- Update profile
  UPDATE profiles SET
    identity_class = p_class_id,
    identity_class_changed_at = NOW(),
    identity_locked_until = NOW() + INTERVAL '30 days'
  WHERE id = user_id;
  
  -- Create ritual moment
  INSERT INTO ritual_moments (user_id, moment_type, title, description, data)
  VALUES (
    user_id,
    CASE WHEN current_class IS NULL THEN 'identity_chosen' ELSE 'identity_changed' END,
    CASE WHEN current_class IS NULL THEN 'Identity Awakened' ELSE 'Identity Evolved' END,
    'You have chosen your path.',
    jsonb_build_object('class', p_class_id)
  );
  
  RETURN jsonb_build_object('success', TRUE, 'class', p_class_id);
END;
$$;

-- 7. RPC: Get Failure Patterns (Insights)
CREATE OR REPLACE FUNCTION public.get_failure_patterns(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  sunday_fail_rate DECIMAL;
  late_night_correlation BOOLEAN;
  weak_time_of_day TEXT;
  avg_streak_before_break DECIMAL;
BEGIN
  -- Sunday failure rate
  SELECT 
    COUNT(CASE WHEN EXTRACT(DOW FROM (completed_at AT TIME ZONE 'Asia/Kolkata')) = 0 THEN 1 END)::DECIMAL /
    NULLIF(COUNT(*)::DECIMAL, 0)
  INTO sunday_fail_rate
  FROM user_quest_log
  WHERE user_id = p_user_id
    AND completed_at IS NULL
    AND created_at > NOW() - INTERVAL '30 days';
  
  -- Check if late night usage correlates with next-day failure
  -- (Simplified: check if quests created after 11 PM have lower completion)
  SELECT 
    (SELECT COUNT(*) FROM user_quest_log 
     WHERE user_id = p_user_id 
     AND EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata') >= 23
     AND completed_at IS NULL) >
    (SELECT COUNT(*) FROM user_quest_log 
     WHERE user_id = p_user_id 
     AND EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata') >= 23
     AND completed_at IS NOT NULL) * 0.5
  INTO late_night_correlation;
  
  -- Average streak before break
  SELECT AVG(last_streak_count) INTO avg_streak_before_break
  FROM profiles WHERE id = p_user_id AND last_streak_count IS NOT NULL;
  
  result := jsonb_build_object(
    'sunday_failure_rate', COALESCE(ROUND(sunday_fail_rate * 100), 0),
    'late_night_correlation', COALESCE(late_night_correlation, FALSE),
    'avg_streak_before_break', COALESCE(ROUND(avg_streak_before_break), 0),
    'insights', jsonb_build_array(
      CASE WHEN sunday_fail_rate > 0.3 THEN 'You lose streaks mostly on Sundays.' END,
      CASE WHEN late_night_correlation THEN 'Late-night usage leads to next-day failure.' END
    )
  );
  
  RETURN result;
END;
$$;

-- 8. RPC: Create Weekly Recap (Ritual Moment)
CREATE OR REPLACE FUNCTION public.create_weekly_recap(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  week_xp INTEGER;
  week_quests INTEGER;
  percentile INTEGER;
  recap_title TEXT;
BEGIN
  -- Get this week's stats
  SELECT COALESCE(SUM(xp_awarded), 0), COUNT(*)
  INTO week_xp, week_quests
  FROM user_quest_log
  WHERE user_id = p_user_id
    AND completed_at IS NOT NULL
    AND completed_at > NOW() - INTERVAL '7 days';
  
  -- Calculate percentile (simplified)
  WITH user_ranks AS (
    SELECT 
      user_id,
      PERCENT_RANK() OVER (ORDER BY COUNT(*) DESC) * 100 as pct
    FROM user_quest_log
    WHERE completed_at > NOW() - INTERVAL '7 days'
    GROUP BY user_id
  )
  SELECT ROUND(100 - pct) INTO percentile
  FROM user_ranks WHERE user_id = p_user_id;
  
  recap_title := 'You beat ' || COALESCE(percentile, 50) || '% of users this week.';
  
  INSERT INTO ritual_moments (user_id, moment_type, title, description, data)
  VALUES (
    p_user_id,
    'weekly_recap',
    recap_title,
    week_quests || ' quests completed. ' || week_xp || ' XP earned.',
    jsonb_build_object('xp', week_xp, 'quests', week_quests, 'percentile', percentile)
  );
  
  RETURN jsonb_build_object('success', TRUE, 'percentile', percentile);
END;
$$;

-- 9. RLS
ALTER TABLE public.identity_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_streak_shields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ritual_moments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_identity_classes" ON public.identity_classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_read_own_ritual_moments" ON public.ritual_moments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "service_manage_ritual_moments" ON public.ritual_moments FOR ALL TO service_role USING (true);
CREATE POLICY "team_members_read_shields" ON public.team_streak_shields FOR SELECT TO authenticated USING (true);

-- 10. Grants
GRANT EXECUTE ON FUNCTION public.choose_identity_class TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_failure_patterns TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_weekly_recap TO service_role;
