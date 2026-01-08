-- ============================================
-- Advanced Features - Isolated Infrastructure
-- Core Loop: READ-ONLY ACCESS ONLY
-- ============================================

-- ============================================
-- 1. FEATURE FLAGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT UNIQUE NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_percent INTEGER DEFAULT 0 CHECK (rollout_percent >= 0 AND rollout_percent <= 100),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default flags (all DISABLED by default)
INSERT INTO public.feature_flags (flag_key, is_enabled, rollout_percent, description) VALUES
  ('enable_ai_coach', false, 0, 'AI coaching insights and suggestions'),
  ('enable_focus_protection', false, 0, 'Focus protection nudges and reminders'),
  ('enable_teams', false, 0, 'Team quests and rivalries'),
  ('enable_identity_system', false, 0, 'Focus archetypes and reflections'),
  ('enable_leagues', false, 0, 'Seasonal leagues and leaderboards')
ON CONFLICT (flag_key) DO NOTHING;

-- ============================================
-- 2. FOCUS PROTECTION LOGS (Isolated)
-- ============================================
CREATE TABLE IF NOT EXISTS public.focus_protection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nudge_type TEXT NOT NULL CHECK (nudge_type IN ('mute_suggestion', 'app_lock', 'phone_down', 'break_reminder')),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  was_dismissed BOOLEAN DEFAULT FALSE,
  quest_id UUID, -- READ-ONLY reference
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 3. AI COACHING INSIGHTS (Observer Only)
-- ============================================
CREATE TABLE IF NOT EXISTS public.ai_coaching_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('pattern', 'suggestion', 'encouragement', 'reflection')),
  content TEXT NOT NULL,
  confidence_score NUMERIC(3,2) DEFAULT 0.5,
  source_data JSONB, -- Historical data used to generate insight
  was_shown BOOLEAN DEFAULT FALSE,
  was_helpful BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 4. USER REFLECTIONS (Identity System)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reflection_type TEXT NOT NULL CHECK (reflection_type IN ('daily', 'weekly', 'monthly', 'milestone')),
  content TEXT NOT NULL,
  summary TEXT,
  archetype TEXT,
  stats_snapshot JSONB, -- READ-ONLY snapshot of user stats
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 5. FEATURE ERROR LOG (Fail-Safe)
-- ============================================
CREATE TABLE IF NOT EXISTS public.feature_error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 6. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON public.feature_flags(flag_key);
CREATE INDEX IF NOT EXISTS idx_focus_logs_user ON public.focus_protection_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_user ON public.ai_coaching_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_reflections_user ON public.user_reflections(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_errors_feature ON public.feature_error_log(feature_key);

-- ============================================
-- 7. RLS POLICIES
-- ============================================
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_protection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_coaching_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_error_log ENABLE ROW LEVEL SECURITY;

-- Feature flags: Everyone can read
CREATE POLICY "Anyone can read feature flags"
  ON public.feature_flags FOR SELECT USING (true);

-- Users can only access their own data
CREATE POLICY "Users view own focus logs"
  ON public.focus_protection_logs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users view own insights"
  ON public.ai_coaching_insights FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users view own reflections"
  ON public.user_reflections FOR SELECT USING (auth.uid() = user_id);

-- Only backend can write (SECURITY DEFINER functions)
CREATE POLICY "System can insert focus logs"
  ON public.focus_protection_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can insert insights"
  ON public.ai_coaching_insights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can insert reflections"
  ON public.user_reflections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 8. FUNCTION: Check Feature Flag (Safe)
-- ============================================
CREATE OR REPLACE FUNCTION public.is_feature_enabled(p_flag_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_enabled BOOLEAN;
  v_rollout_percent INTEGER;
  v_user_hash INTEGER;
BEGIN
  SELECT is_enabled, rollout_percent INTO v_is_enabled, v_rollout_percent
  FROM feature_flags WHERE flag_key = p_flag_key;

  IF v_is_enabled IS NULL THEN
    RETURN FALSE;
  END IF;

  IF NOT v_is_enabled THEN
    RETURN FALSE;
  END IF;

  -- 100% rollout = everyone
  IF v_rollout_percent >= 100 THEN
    RETURN TRUE;
  END IF;

  -- Gradual rollout based on user ID hash
  v_user_hash := ABS(hashtext(auth.uid()::TEXT)) % 100;
  RETURN v_user_hash < v_rollout_percent;
END;
$$;

-- ============================================
-- 9. FUNCTION: Log Feature Error (Fail-Safe)
-- ============================================
CREATE OR REPLACE FUNCTION public.log_feature_error(
  p_feature_key TEXT,
  p_error_message TEXT,
  p_context JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO feature_error_log (feature_key, user_id, error_message, context)
  VALUES (p_feature_key, auth.uid(), p_error_message, p_context);
EXCEPTION WHEN OTHERS THEN
  -- Silently fail - never break core loop
  NULL;
END;
$$;

-- ============================================
-- 10. FUNCTION: Generate AI Insight (Observer Only)
-- READS quest/xp data, NEVER modifies it
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_ai_insight(p_insight_type TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_enabled BOOLEAN;
  v_stats JSONB;
  v_content TEXT;
BEGIN
  v_user_id := auth.uid();
  
  -- Check feature flag first
  IF NOT is_feature_enabled('enable_ai_coach') THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;

  -- READ-ONLY: Gather user stats (never modify)
  SELECT jsonb_build_object(
    'total_xp', COALESCE(p.xp, 0),
    'level', COALESCE(p.level, 1),
    'streak', COALESCE(p.streak, 0),
    'quests_completed', (
      SELECT COUNT(*) FROM user_quest_log 
      WHERE user_id = v_user_id AND completed_at IS NOT NULL
    )
  ) INTO v_stats
  FROM profiles p WHERE p.id = v_user_id;

  -- Generate insight based on stats (READ-ONLY logic)
  v_content := CASE 
    WHEN (v_stats->>'streak')::INTEGER >= 7 THEN 
      'Your consistency is remarkable! You''ve maintained focus for a week straight.'
    WHEN (v_stats->>'streak')::INTEGER = 0 THEN 
      'Every journey starts with a single step. Complete a quest today to begin your streak.'
    WHEN (v_stats->>'quests_completed')::INTEGER > 10 THEN
      'You''ve completed ' || (v_stats->>'quests_completed') || ' quests. You''re building real discipline.'
    ELSE
      'Keep going! Each quest brings you closer to your goals.'
  END;

  -- Store insight (isolated table)
  INSERT INTO ai_coaching_insights (user_id, insight_type, content, source_data)
  VALUES (v_user_id, p_insight_type, v_content, v_stats);

  RETURN jsonb_build_object(
    'enabled', true,
    'insight', v_content,
    'stats', v_stats
  );
EXCEPTION WHEN OTHERS THEN
  -- Fail silently, log error
  PERFORM log_feature_error('ai_coach', SQLERRM);
  RETURN jsonb_build_object('enabled', false, 'error', 'Feature temporarily unavailable');
END;
$$;

-- ============================================
-- 11. GRANTS
-- ============================================
GRANT EXECUTE ON FUNCTION public.is_feature_enabled(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_feature_error(TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_ai_insight(TEXT) TO authenticated;

-- Reload schema
NOTIFY pgrst, 'reload config';
