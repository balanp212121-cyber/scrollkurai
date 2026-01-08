-- ============================================
-- Quest-Centric League System
-- QUEST_COMPLETED = Single Source of Truth
-- All systems are listeners, not controllers
-- ============================================

-- ============================================
-- 1. USER LEAGUE STANDINGS
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_league_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  league_tier TEXT NOT NULL DEFAULT 'Bronze' CHECK (league_tier IN ('Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond')),
  league_points INTEGER NOT NULL DEFAULT 0,
  weekly_quests_completed INTEGER NOT NULL DEFAULT 0,
  weekly_xp_earned INTEGER NOT NULL DEFAULT 0,
  week_start_date DATE NOT NULL DEFAULT date_trunc('week', CURRENT_DATE)::DATE,
  last_promotion_date DATE,
  last_demotion_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 2. LEAGUE HISTORY (Immutable Record)
-- ============================================
CREATE TABLE IF NOT EXISTS public.league_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_date DATE NOT NULL,
  league_tier TEXT NOT NULL,
  final_rank INTEGER,
  quests_completed INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  promotion_status TEXT CHECK (promotion_status IN ('promoted', 'demoted', 'stable')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 3. COMPLETION INSIGHTS (Read-Only Observer)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_completion_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_key TEXT NOT NULL,
  insight_value JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days')
);

-- ============================================
-- 4. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_league_standings_tier ON public.user_league_standings(league_tier);
CREATE INDEX IF NOT EXISTS idx_league_standings_points ON public.user_league_standings(league_points DESC);
CREATE INDEX IF NOT EXISTS idx_league_history_user ON public.league_history(user_id, week_date);
CREATE INDEX IF NOT EXISTS idx_insights_user ON public.user_completion_insights(user_id);

-- ============================================
-- 5. RLS POLICIES
-- ============================================
ALTER TABLE public.user_league_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_completion_insights ENABLE ROW LEVEL SECURITY;

-- League standings: Everyone can read (leaderboard), users can see their own
CREATE POLICY "Anyone can view league standings"
  ON public.user_league_standings FOR SELECT USING (true);

CREATE POLICY "Users can view their league history"
  ON public.league_history FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their insights"
  ON public.user_completion_insights FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- 6. CORE FUNCTION: On Quest Completed (Event Listener)
-- ============================================
CREATE OR REPLACE FUNCTION public.on_quest_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_xp_reward INTEGER;
  v_current_week DATE;
BEGIN
  -- Only trigger on completion
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    v_user_id := NEW.user_id;
    v_current_week := date_trunc('week', CURRENT_DATE)::DATE;
    
    -- Get XP reward (read-only from quests table)
    SELECT COALESCE(q.reward_xp, 50) INTO v_xp_reward
    FROM quests q WHERE q.id = NEW.quest_id;

    -- Update league standings (derived from quest completion)
    INSERT INTO user_league_standings (
      user_id, league_points, weekly_quests_completed, weekly_xp_earned, week_start_date
    )
    VALUES (
      v_user_id, v_xp_reward, 1, v_xp_reward, v_current_week
    )
    ON CONFLICT (user_id) DO UPDATE
    SET 
      league_points = user_league_standings.league_points + v_xp_reward,
      weekly_quests_completed = CASE 
        WHEN user_league_standings.week_start_date = v_current_week 
        THEN user_league_standings.weekly_quests_completed + 1
        ELSE 1 
      END,
      weekly_xp_earned = CASE 
        WHEN user_league_standings.week_start_date = v_current_week 
        THEN user_league_standings.weekly_xp_earned + v_xp_reward
        ELSE v_xp_reward 
      END,
      week_start_date = v_current_week,
      updated_at = now();

    -- Log to admin (silent, never fails core)
    BEGIN
      INSERT INTO admin_audit_logs (admin_id, action_type, details)
      VALUES (v_user_id, 'QUEST_COMPLETED_LEAGUE_UPDATE', 
        jsonb_build_object('xp', v_xp_reward, 'quest_id', NEW.quest_id));
    EXCEPTION WHEN OTHERS THEN
      -- Silent fail - never break core
      NULL;
    END;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- FAIL-SAFE: Never break quest completion
  RETURN NEW;
END;
$$;

-- Create trigger on user_quest_log (the canonical completion table)
DROP TRIGGER IF EXISTS trg_quest_completed_league ON public.user_quest_log;
CREATE TRIGGER trg_quest_completed_league
  AFTER UPDATE ON public.user_quest_log
  FOR EACH ROW
  EXECUTE FUNCTION public.on_quest_completed();

-- ============================================
-- 7. WEEKLY PROMOTION/DEMOTION FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.run_weekly_league_evaluation()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promoted INTEGER := 0;
  v_demoted INTEGER := 0;
  v_stable INTEGER := 0;
  v_current_week DATE;
  v_tier TEXT;
  v_tiers TEXT[] := ARRAY['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
BEGIN
  v_current_week := date_trunc('week', CURRENT_DATE)::DATE;

  -- Process each tier
  FOREACH v_tier IN ARRAY v_tiers
  LOOP
    -- Archive current standings to history
    INSERT INTO league_history (user_id, week_date, league_tier, quests_completed, xp_earned, final_rank, promotion_status)
    SELECT 
      uls.user_id,
      v_current_week,
      uls.league_tier,
      uls.weekly_quests_completed,
      uls.weekly_xp_earned,
      ROW_NUMBER() OVER (ORDER BY uls.weekly_xp_earned DESC),
      'stable'
    FROM user_league_standings uls
    WHERE uls.league_tier = v_tier;

    -- Promote top 20% (except Diamond)
    IF v_tier != 'Diamond' THEN
      WITH ranked AS (
        SELECT user_id, 
          ROW_NUMBER() OVER (ORDER BY weekly_xp_earned DESC) as rank,
          COUNT(*) OVER () as total
        FROM user_league_standings
        WHERE league_tier = v_tier AND weekly_quests_completed >= 3
      ),
      top_20 AS (
        SELECT user_id FROM ranked WHERE rank <= GREATEST(1, total * 0.2)
      )
      UPDATE user_league_standings uls
      SET 
        league_tier = CASE v_tier
          WHEN 'Bronze' THEN 'Silver'
          WHEN 'Silver' THEN 'Gold'
          WHEN 'Gold' THEN 'Platinum'
          WHEN 'Platinum' THEN 'Diamond'
          ELSE v_tier
        END,
        last_promotion_date = CURRENT_DATE
      FROM top_20
      WHERE uls.user_id = top_20.user_id;

      GET DIAGNOSTICS v_promoted = ROW_COUNT;
    END IF;

    -- Demote bottom 20% (except Bronze)
    IF v_tier != 'Bronze' THEN
      WITH ranked AS (
        SELECT user_id,
          ROW_NUMBER() OVER (ORDER BY weekly_xp_earned ASC) as rank,
          COUNT(*) OVER () as total
        FROM user_league_standings
        WHERE league_tier = v_tier
      ),
      bottom_20 AS (
        SELECT user_id FROM ranked WHERE rank <= GREATEST(1, total * 0.2)
      )
      UPDATE user_league_standings uls
      SET 
        league_tier = CASE v_tier
          WHEN 'Silver' THEN 'Bronze'
          WHEN 'Gold' THEN 'Silver'
          WHEN 'Platinum' THEN 'Gold'
          WHEN 'Diamond' THEN 'Platinum'
          ELSE v_tier
        END,
        last_demotion_date = CURRENT_DATE
      FROM bottom_20
      WHERE uls.user_id = bottom_20.user_id;

      GET DIAGNOSTICS v_demoted = ROW_COUNT;
    END IF;
  END LOOP;

  -- Reset weekly counters for new week
  UPDATE user_league_standings
  SET 
    weekly_quests_completed = 0,
    weekly_xp_earned = 0,
    week_start_date = v_current_week + INTERVAL '7 days';

  v_stable := (SELECT COUNT(*) FROM user_league_standings) - v_promoted - v_demoted;

  RETURN jsonb_build_object(
    'success', true,
    'promoted', v_promoted,
    'demoted', v_demoted,
    'stable', v_stable,
    'week', v_current_week
  );
END;
$$;

-- ============================================
-- 8. INSIGHTS GENERATOR (Observer Only)
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_completion_insights(p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_insights JSONB := '[]'::JSONB;
  v_avg_completion_hour INTEGER;
  v_quick_completions INTEGER;
  v_streak INTEGER;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No user');
  END IF;

  -- READ-ONLY: Analyze completion patterns
  -- Best time of day
  SELECT EXTRACT(HOUR FROM completed_at)::INTEGER INTO v_avg_completion_hour
  FROM user_quest_log
  WHERE user_id = v_user_id AND completed_at IS NOT NULL
  GROUP BY EXTRACT(HOUR FROM completed_at)
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  IF v_avg_completion_hour IS NOT NULL THEN
    INSERT INTO user_completion_insights (user_id, insight_key, insight_value)
    VALUES (v_user_id, 'best_hour', jsonb_build_object(
      'hour', v_avg_completion_hour,
      'message', 'You focus best around ' || 
        CASE 
          WHEN v_avg_completion_hour < 12 THEN v_avg_completion_hour || ' AM'
          WHEN v_avg_completion_hour = 12 THEN '12 PM'
          ELSE (v_avg_completion_hour - 12) || ' PM'
        END
    ))
    ON CONFLICT DO NOTHING;

    v_insights := v_insights || jsonb_build_object('type', 'best_hour', 'hour', v_avg_completion_hour);
  END IF;

  -- Get current streak
  SELECT streak INTO v_streak FROM profiles WHERE id = v_user_id;
  
  IF v_streak >= 7 THEN
    v_insights := v_insights || jsonb_build_object(
      'type', 'streak_milestone',
      'message', 'You''ve maintained focus for ' || v_streak || ' days straight!'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'insights', v_insights
  );
EXCEPTION WHEN OTHERS THEN
  -- Silent fail - insights are optional
  RETURN jsonb_build_object('success', false);
END;
$$;

-- ============================================
-- 9. GET USER LEAGUE INFO
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_league_info()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_standing RECORD;
  v_rank INTEGER;
  v_tier_count INTEGER;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get user's standing
  SELECT * INTO v_standing FROM user_league_standings WHERE user_id = v_user_id;
  
  IF v_standing IS NULL THEN
    -- Initialize new user in Bronze
    INSERT INTO user_league_standings (user_id) VALUES (v_user_id)
    RETURNING * INTO v_standing;
  END IF;

  -- Calculate rank within tier
  SELECT COUNT(*) INTO v_tier_count
  FROM user_league_standings
  WHERE league_tier = v_standing.league_tier;

  SELECT COUNT(*) INTO v_rank
  FROM user_league_standings
  WHERE league_tier = v_standing.league_tier
    AND league_points > v_standing.league_points;

  RETURN jsonb_build_object(
    'success', true,
    'tier', v_standing.league_tier,
    'points', v_standing.league_points,
    'weekly_quests', v_standing.weekly_quests_completed,
    'weekly_xp', v_standing.weekly_xp_earned,
    'rank', v_rank + 1,
    'tier_total', v_tier_count
  );
END;
$$;

-- ============================================
-- 10. GRANTS
-- ============================================
GRANT EXECUTE ON FUNCTION public.run_weekly_league_evaluation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_completion_insights(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_league_info() TO authenticated;

-- Reload schema
NOTIFY pgrst, 'reload config';
