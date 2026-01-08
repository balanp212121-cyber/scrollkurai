-- ============================================
-- Team Leaderboards, Seasonal Leagues & Founder Mode
-- Production-grade competitive system
-- ============================================

-- ============================================
-- 1. SEASONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'ended')),
  league_tiers JSONB DEFAULT '["Bronze", "Silver", "Gold", "Platinum", "Diamond"]'::jsonb,
  rewards JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Only one active season allowed
  CONSTRAINT only_one_active_season EXCLUDE (status WITH =) WHERE (status = 'active')
);

-- ============================================
-- 2. TEAM SEASON STATS
-- ============================================
CREATE TABLE IF NOT EXISTS public.team_season_stats (
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  total_xp INTEGER NOT NULL DEFAULT 0,
  quests_completed INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  league_tier TEXT DEFAULT 'Bronze',
  is_disqualified BOOLEAN DEFAULT FALSE,
  disqualification_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  PRIMARY KEY (team_id, season_id)
);

-- ============================================
-- 3. TEAM LEADERBOARD CACHE (Backend write-only)
-- ============================================
CREATE TABLE IF NOT EXISTS public.team_leaderboard_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  team_name TEXT,
  rank INTEGER NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  total_xp INTEGER NOT NULL DEFAULT 0,
  quests_completed INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  league_tier TEXT DEFAULT 'Bronze',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (season_id, team_id)
);

-- ============================================
-- 4. ADMIN ACTIONS LOG (Founder Mode Audit)
-- ============================================
CREATE TABLE IF NOT EXISTS public.admin_actions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  previous_value JSONB,
  new_value JSONB,
  reason TEXT NOT NULL,
  is_reverted BOOLEAN DEFAULT FALSE,
  reverted_at TIMESTAMPTZ,
  reverted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 5. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_seasons_status ON public.seasons(status);
CREATE INDEX IF NOT EXISTS idx_seasons_dates ON public.seasons(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_team_season_stats_rank ON public.team_season_stats(season_id, rank);
CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_rank ON public.team_leaderboard_cache(season_id, rank);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON public.admin_actions_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON public.admin_actions_log(target_type, target_id);

-- ============================================
-- 6. RLS POLICIES
-- ============================================
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_season_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_leaderboard_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions_log ENABLE ROW LEVEL SECURITY;

-- Seasons: Everyone can read, admins can write
CREATE POLICY "Anyone can read seasons"
  ON public.seasons FOR SELECT USING (true);

CREATE POLICY "Admins can manage seasons"
  ON public.seasons FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

-- Team Season Stats: Read by team members, write by backend
CREATE POLICY "Team members can view season stats"
  ON public.team_season_stats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = team_season_stats.team_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage season stats"
  ON public.team_season_stats FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

-- Leaderboard Cache: Read by everyone, write by admins only
CREATE POLICY "Anyone can read leaderboard"
  ON public.team_leaderboard_cache FOR SELECT USING (true);

CREATE POLICY "Admins can update leaderboard"
  ON public.team_leaderboard_cache FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

-- Admin Actions: Only admins can read/write
CREATE POLICY "Admins can access admin actions"
  ON public.admin_actions_log FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

-- ============================================
-- 7. FUNCTION: Calculate Leaderboard Score
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_leaderboard_score(
  p_xp INTEGER,
  p_quests_completed INTEGER,
  p_streak INTEGER
)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (p_xp * 1) + (p_quests_completed * 50) + (p_streak * 20);
$$;

-- ============================================
-- 8. FUNCTION: Recalculate Team Leaderboard
-- ============================================
CREATE OR REPLACE FUNCTION public.recalculate_team_leaderboard(p_season_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_id UUID;
  v_teams_updated INTEGER := 0;
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();
  
  -- Get active season if not specified
  IF p_season_id IS NULL THEN
    SELECT id INTO v_season_id FROM seasons WHERE status = 'active' LIMIT 1;
  ELSE
    v_season_id := p_season_id;
  END IF;

  IF v_season_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active season found');
  END IF;

  -- Clear existing cache for this season
  DELETE FROM team_leaderboard_cache WHERE season_id = v_season_id;

  -- Recalculate and insert ranked teams
  WITH ranked_teams AS (
    SELECT 
      tss.team_id,
      t.name AS team_name,
      tss.total_xp,
      tss.quests_completed,
      tss.current_streak,
      tss.league_tier,
      calculate_leaderboard_score(tss.total_xp, tss.quests_completed, tss.current_streak) AS score,
      ROW_NUMBER() OVER (
        ORDER BY calculate_leaderboard_score(tss.total_xp, tss.quests_completed, tss.current_streak) DESC
      ) AS rank
    FROM team_season_stats tss
    JOIN teams t ON t.id = tss.team_id
    WHERE tss.season_id = v_season_id
    AND tss.is_disqualified = FALSE
  )
  INSERT INTO team_leaderboard_cache (
    season_id, team_id, team_name, rank, score, 
    total_xp, quests_completed, current_streak, league_tier
  )
  SELECT 
    v_season_id, team_id, team_name, rank, score,
    total_xp, quests_completed, current_streak, league_tier
  FROM ranked_teams;

  GET DIAGNOSTICS v_teams_updated = ROW_COUNT;

  -- Update ranks in team_season_stats
  UPDATE team_season_stats tss
  SET rank = tlc.rank, updated_at = now()
  FROM team_leaderboard_cache tlc
  WHERE tss.team_id = tlc.team_id 
  AND tss.season_id = tlc.season_id
  AND tlc.season_id = v_season_id;

  -- Log admin action
  INSERT INTO admin_actions_log (admin_id, action_type, target_type, target_id, reason)
  VALUES (v_admin_id, 'LEADERBOARD_RECALCULATED', 'season', v_season_id, 'Manual recalculation');

  RETURN jsonb_build_object(
    'success', true,
    'season_id', v_season_id,
    'teams_ranked', v_teams_updated
  );
END;
$$;

-- ============================================
-- 9. FUNCTION: Admin Override (Founder Mode)
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_override(
  p_action_type TEXT,
  p_target_type TEXT,
  p_target_id UUID,
  p_new_value JSONB,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_is_admin BOOLEAN;
  v_previous_value JSONB;
BEGIN
  v_admin_id := auth.uid();
  
  -- Verify admin
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = v_admin_id AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin access required');
  END IF;

  -- Validate reason
  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reason must be at least 10 characters');
  END IF;

  -- Execute based on action type
  CASE p_action_type
    WHEN 'ADJUST_TEAM_XP' THEN
      -- Get previous value
      SELECT jsonb_build_object('total_xp', total_xp) INTO v_previous_value
      FROM team_season_stats
      WHERE team_id = p_target_id AND season_id = (SELECT id FROM seasons WHERE status = 'active');

      UPDATE team_season_stats
      SET total_xp = (p_new_value->>'total_xp')::INTEGER, updated_at = now()
      WHERE team_id = p_target_id AND season_id = (SELECT id FROM seasons WHERE status = 'active');

    WHEN 'RESET_TEAM_STREAK' THEN
      SELECT jsonb_build_object('current_streak', current_streak) INTO v_previous_value
      FROM team_season_stats
      WHERE team_id = p_target_id AND season_id = (SELECT id FROM seasons WHERE status = 'active');

      UPDATE team_season_stats
      SET current_streak = 0, updated_at = now()
      WHERE team_id = p_target_id AND season_id = (SELECT id FROM seasons WHERE status = 'active');

    WHEN 'DISQUALIFY_TEAM' THEN
      SELECT jsonb_build_object('is_disqualified', is_disqualified) INTO v_previous_value
      FROM team_season_stats
      WHERE team_id = p_target_id AND season_id = (SELECT id FROM seasons WHERE status = 'active');

      UPDATE team_season_stats
      SET is_disqualified = TRUE, disqualification_reason = p_reason, updated_at = now()
      WHERE team_id = p_target_id AND season_id = (SELECT id FROM seasons WHERE status = 'active');

    WHEN 'REINSTATE_TEAM' THEN
      UPDATE team_season_stats
      SET is_disqualified = FALSE, disqualification_reason = NULL, updated_at = now()
      WHERE team_id = p_target_id AND season_id = (SELECT id FROM seasons WHERE status = 'active');

    WHEN 'END_SEASON' THEN
      UPDATE seasons SET status = 'ended', updated_at = now() WHERE id = p_target_id;

    WHEN 'EXTEND_SEASON' THEN
      UPDATE seasons 
      SET end_date = (p_new_value->>'end_date')::DATE, updated_at = now()
      WHERE id = p_target_id;

    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Unknown action type');
  END CASE;

  -- Log the action
  INSERT INTO admin_actions_log (
    admin_id, action_type, target_type, target_id, 
    previous_value, new_value, reason
  )
  VALUES (
    v_admin_id, p_action_type, p_target_type, p_target_id,
    v_previous_value, p_new_value, p_reason
  );

  -- Recalculate leaderboard after override
  PERFORM recalculate_team_leaderboard();

  RETURN jsonb_build_object(
    'success', true,
    'action', p_action_type,
    'logged', true
  );
END;
$$;

-- ============================================
-- 10. FUNCTION: Start New Season
-- ============================================
CREATE OR REPLACE FUNCTION public.start_new_season(
  p_name TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_new_season_id UUID;
  v_teams_initialized INTEGER;
BEGIN
  v_admin_id := auth.uid();

  -- End current active season
  UPDATE seasons SET status = 'ended', updated_at = now() WHERE status = 'active';

  -- Create new season
  INSERT INTO seasons (name, description, start_date, end_date, status)
  VALUES (p_name, p_description, p_start_date, p_end_date, 'active')
  RETURNING id INTO v_new_season_id;

  -- Initialize stats for all teams
  INSERT INTO team_season_stats (team_id, season_id, total_xp, quests_completed, current_streak)
  SELECT id, v_new_season_id, 0, 0, 0 FROM teams;

  GET DIAGNOSTICS v_teams_initialized = ROW_COUNT;

  -- Log action
  INSERT INTO admin_actions_log (admin_id, action_type, target_type, target_id, reason)
  VALUES (v_admin_id, 'SEASON_STARTED', 'season', v_new_season_id, 'New season initialized');

  RETURN jsonb_build_object(
    'success', true,
    'season_id', v_new_season_id,
    'teams_initialized', v_teams_initialized
  );
END;
$$;

-- ============================================
-- 11. TRIGGER: Auto-update team stats on quest completion
-- ============================================
CREATE OR REPLACE FUNCTION public.update_team_season_stats_on_quest()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id UUID;
  v_active_season_id UUID;
  v_xp_reward INTEGER;
BEGIN
  -- Only trigger on team quest completion
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    v_team_id := NEW.team_id;
    v_xp_reward := COALESCE(NEW.xp_reward, 100);

    SELECT id INTO v_active_season_id FROM seasons WHERE status = 'active' LIMIT 1;

    IF v_active_season_id IS NOT NULL THEN
      -- Update team season stats
      INSERT INTO team_season_stats (team_id, season_id, total_xp, quests_completed)
      VALUES (v_team_id, v_active_season_id, v_xp_reward, 1)
      ON CONFLICT (team_id, season_id) DO UPDATE
      SET 
        total_xp = team_season_stats.total_xp + v_xp_reward,
        quests_completed = team_season_stats.quests_completed + 1,
        updated_at = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_team_stats_on_quest ON public.team_quests;
CREATE TRIGGER trg_update_team_stats_on_quest
  AFTER UPDATE ON public.team_quests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_team_season_stats_on_quest();

-- ============================================
-- 12. GRANTS
-- ============================================
GRANT EXECUTE ON FUNCTION public.calculate_leaderboard_score(INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_team_leaderboard(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_override(TEXT, TEXT, UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_new_season(TEXT, DATE, DATE, TEXT) TO authenticated;

-- ============================================
-- 13. INSERT DEFAULT SEASON
-- ============================================
INSERT INTO public.seasons (name, description, start_date, end_date, status)
VALUES (
  'Season 1: Genesis',
  'The first competitive season of ScrollKurai',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '30 days',
  'active'
) ON CONFLICT DO NOTHING;

-- Reload schema
NOTIFY pgrst, 'reload config';
