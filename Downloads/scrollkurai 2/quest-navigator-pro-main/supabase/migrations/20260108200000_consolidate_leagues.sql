-- ============================================
-- League System Consolidation Migration
-- Single Source of Truth: user_league_standings
-- Triggered ONLY by quest completion
-- ============================================

-- ============================================
-- 1. UPDATE get_league_leaderboard RPC
-- Now reads from user_league_standings (canonical)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_league_leaderboard(
  league_tier_param TEXT DEFAULT 'Bronze'
)
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  xp_earned INTEGER,
  rank INTEGER,
  league_tier TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uls.user_id,
    COALESCE(p.username, 'Anonymous') as username,
    -- Ranking Score Formula: weekly_xp + (quests_completed * 25)
    (uls.weekly_xp_earned + (uls.weekly_quests_completed * 25))::INTEGER as xp_earned,
    CAST(
      ROW_NUMBER() OVER (
        ORDER BY 
          (uls.weekly_xp_earned + (uls.weekly_quests_completed * 25)) DESC,
          uls.weekly_quests_completed DESC,
          uls.updated_at ASC
      ) AS INTEGER
    ) as rank,
    uls.league_tier
  FROM user_league_standings uls
  LEFT JOIN profiles p ON p.id = uls.user_id
  WHERE uls.league_tier = league_tier_param
  ORDER BY 
    (uls.weekly_xp_earned + (uls.weekly_quests_completed * 25)) DESC,
    uls.weekly_quests_completed DESC,
    uls.updated_at ASC;
END;
$$;

-- ============================================
-- 2. ENSURE FIRST QUEST AUTO-ASSIGNS TO BRONZE
-- (Already handled in on_quest_completed trigger)
-- This is a safety net INSERT helper
-- ============================================
CREATE OR REPLACE FUNCTION public.ensure_league_membership(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_league_standings (user_id, league_tier)
  VALUES (p_user_id, 'Bronze')
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- ============================================
-- 3. IDEMPOTENCY GUARD FOR QUEST COMPLETION
-- Prevents double-counting if same log_id processed twice
-- ============================================
-- Add processed_log_ids array to track completed quests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_league_standings' 
    AND column_name = 'processed_log_ids'
  ) THEN
    ALTER TABLE user_league_standings 
    ADD COLUMN processed_log_ids UUID[] DEFAULT '{}';
  END IF;
END $$;

-- Update trigger to check idempotency
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
  v_log_id UUID;
  v_already_processed BOOLEAN;
BEGIN
  -- Only trigger on completion
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    v_user_id := NEW.user_id;
    v_log_id := NEW.id;
    v_current_week := date_trunc('week', CURRENT_DATE)::DATE;
    
    -- IDEMPOTENCY CHECK: Has this log_id already been processed?
    SELECT v_log_id = ANY(processed_log_ids) INTO v_already_processed
    FROM user_league_standings
    WHERE user_id = v_user_id;
    
    -- If already processed AND user exists, skip
    IF v_already_processed IS TRUE THEN
      RETURN NEW; -- Already counted, don't double-count
    END IF;
    
    -- Get XP reward (read-only from quests table)
    SELECT COALESCE(q.reward_xp, 50) INTO v_xp_reward
    FROM quests q WHERE q.id = NEW.quest_id;
    
    IF v_xp_reward IS NULL THEN
      v_xp_reward := 50; -- Default fallback
    END IF;

    -- Update league standings (derived from quest completion)
    INSERT INTO user_league_standings (
      user_id, league_tier, league_points, weekly_quests_completed, weekly_xp_earned, week_start_date, processed_log_ids
    )
    VALUES (
      v_user_id, 'Bronze', v_xp_reward, 1, v_xp_reward, v_current_week, ARRAY[v_log_id]
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
      processed_log_ids = array_append(user_league_standings.processed_log_ids, v_log_id),
      updated_at = now();

    -- Log to admin (silent, never fails core)
    BEGIN
      INSERT INTO admin_audit_logs (admin_id, action_type, details)
      VALUES (v_user_id, 'QUEST_COMPLETED_LEAGUE_UPDATE', 
        jsonb_build_object('xp', v_xp_reward, 'quest_id', NEW.quest_id, 'log_id', v_log_id));
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

-- ============================================
-- 4. GRANTS
-- ============================================
GRANT EXECUTE ON FUNCTION public.get_league_leaderboard(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_league_leaderboard(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.ensure_league_membership(UUID) TO authenticated;

-- ============================================
-- 5. NOTIFY RELOAD
-- ============================================
NOTIFY pgrst, 'reload config';
