-- ============================================
-- Team Quests, Anti-Cheat, Streaks & Rivalries
-- Production-grade multiplayer quest system
-- ============================================

-- ============================================
-- 1. TEAM QUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.team_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  quest_id UUID NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'expired')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  xp_reward INTEGER NOT NULL DEFAULT 100,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint: one active quest per team per quest
  UNIQUE (team_id, quest_id, status)
);

-- ============================================
-- 2. TEAM QUEST PROGRESS (Per Member)
-- ============================================
CREATE TABLE IF NOT EXISTS public.team_quest_progress (
  team_quest_id UUID NOT NULL REFERENCES public.team_quests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  last_update TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  -- Anti-cheat fields
  is_flagged BOOLEAN DEFAULT FALSE,
  flag_reason TEXT,
  total_updates INTEGER DEFAULT 0,
  
  PRIMARY KEY (team_quest_id, user_id)
);

-- ============================================
-- 3. TEAM STREAKS
-- ============================================
CREATE TABLE IF NOT EXISTS public.team_streaks (
  team_id UUID PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_completed_date DATE,
  streak_shield_active BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 4. TEAM RIVALRIES
-- ============================================
CREATE TABLE IF NOT EXISTS public.team_rivalries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_a UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  team_b UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  team_a_score INTEGER NOT NULL DEFAULT 0,
  team_b_score INTEGER NOT NULL DEFAULT 0,
  winner_team_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure unique active rivalry between teams
  CONSTRAINT unique_active_rivalry UNIQUE (team_a, team_b, is_active)
);

-- ============================================
-- 5. ANTI-CHEAT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS public.anti_cheat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_quest_id UUID REFERENCES public.team_quests(id) ON DELETE SET NULL,
  flag_type TEXT NOT NULL CHECK (flag_type IN ('SPEED_HACK', 'PROGRESS_SPAM', 'PATTERN_ABUSE', 'DUPLICATE_COMPLETION')),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 6. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_team_quests_team_id ON public.team_quests(team_id);
CREATE INDEX IF NOT EXISTS idx_team_quests_status ON public.team_quests(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_team_quest_progress_quest ON public.team_quest_progress(team_quest_id);
CREATE INDEX IF NOT EXISTS idx_team_rivalries_active ON public.team_rivalries(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_anti_cheat_user ON public.anti_cheat_logs(user_id);

-- ============================================
-- 7. RLS POLICIES
-- ============================================
ALTER TABLE public.team_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_quest_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_rivalries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anti_cheat_logs ENABLE ROW LEVEL SECURITY;

-- Team Quests: Members can read, admins can insert
CREATE POLICY "Team members can view team quests"
  ON public.team_quests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = team_quests.team_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team admins can create team quests"
  ON public.team_quests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = team_quests.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('admin', 'creator')
    )
  );

-- Team Quest Progress: Users can update ONLY their own progress
CREATE POLICY "Users can view team quest progress"
  ON public.team_quest_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_quests tq
      JOIN public.team_members tm ON tm.team_id = tq.team_id
      WHERE tq.id = team_quest_progress.team_quest_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update only their own progress"
  ON public.team_quest_progress FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Team Streaks: Members can read
CREATE POLICY "Team members can view streaks"
  ON public.team_streaks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = team_streaks.team_id
      AND tm.user_id = auth.uid()
    )
  );

-- Team Rivalries: Involved teams can read
CREATE POLICY "Rivalry participants can view"
  ON public.team_rivalries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE (tm.team_id = team_rivalries.team_a OR tm.team_id = team_rivalries.team_b)
      AND tm.user_id = auth.uid()
    )
  );

-- Anti-cheat: Only admins can read
CREATE POLICY "Admins can view anti-cheat logs"
  ON public.anti_cheat_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
    )
  );

-- ============================================
-- 8. FUNCTIONS: PROGRESS UPDATE WITH THROTTLING
-- ============================================
CREATE OR REPLACE FUNCTION public.update_team_quest_progress(
  p_team_quest_id UUID,
  p_progress_percent INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_current_progress INTEGER;
  v_last_update TIMESTAMPTZ;
  v_total_updates INTEGER;
  v_time_since_last INTERVAL;
  v_is_flagged BOOLEAN := FALSE;
  v_flag_reason TEXT;
  v_result JSONB;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get current progress
  SELECT progress_percent, last_update, total_updates, is_flagged
  INTO v_current_progress, v_last_update, v_total_updates, v_is_flagged
  FROM team_quest_progress
  WHERE team_quest_id = p_team_quest_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Progress record not found');
  END IF;

  -- If already flagged, reject updates
  IF v_is_flagged THEN
    RETURN jsonb_build_object('success', false, 'error', 'Progress updates blocked', 'code', 'FLAGGED');
  END IF;

  -- Anti-cheat: Progress throttling (max 25% per 10 minutes)
  v_time_since_last := now() - v_last_update;
  
  IF v_time_since_last < INTERVAL '10 minutes' THEN
    IF (p_progress_percent - v_current_progress) > 25 THEN
      v_is_flagged := TRUE;
      v_flag_reason := 'PROGRESS_SPAM: Exceeded 25% in 10 minutes';
      
      INSERT INTO anti_cheat_logs (user_id, team_quest_id, flag_type, details)
      VALUES (v_user_id, p_team_quest_id, 'PROGRESS_SPAM', 
        jsonb_build_object('attempt', p_progress_percent, 'current', v_current_progress, 'time_since', v_time_since_last));
    END IF;
  END IF;

  -- Update progress
  UPDATE team_quest_progress
  SET 
    progress_percent = LEAST(p_progress_percent, 100),
    last_update = now(),
    total_updates = v_total_updates + 1,
    is_flagged = v_is_flagged,
    flag_reason = COALESCE(v_flag_reason, flag_reason),
    completed_at = CASE WHEN p_progress_percent >= 100 THEN now() ELSE completed_at END
  WHERE team_quest_id = p_team_quest_id AND user_id = v_user_id;

  -- Check if team quest should complete
  PERFORM check_team_quest_completion(p_team_quest_id);

  RETURN jsonb_build_object(
    'success', NOT v_is_flagged,
    'progress', LEAST(p_progress_percent, 100),
    'flagged', v_is_flagged,
    'message', CASE WHEN v_is_flagged THEN v_flag_reason ELSE 'Progress updated' END
  );
END;
$$;

-- ============================================
-- 9. FUNCTION: CHECK TEAM QUEST COMPLETION
-- ============================================
CREATE OR REPLACE FUNCTION public.check_team_quest_completion(p_team_quest_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id UUID;
  v_total_members INTEGER;
  v_eligible_members INTEGER;
  v_completion_threshold NUMERIC := 0.7; -- 70% of members
  v_progress_threshold INTEGER := 80;    -- 80% progress each
  v_quest_status TEXT;
  v_xp_reward INTEGER;
BEGIN
  -- Get quest info
  SELECT team_id, status, xp_reward 
  INTO v_team_id, v_quest_status, v_xp_reward
  FROM team_quests 
  WHERE id = p_team_quest_id;

  IF v_quest_status != 'active' THEN
    RETURN FALSE;
  END IF;

  -- Count total team members
  SELECT COUNT(*) INTO v_total_members
  FROM team_members WHERE team_id = v_team_id;

  -- Count eligible members (>= 80% progress, not flagged)
  SELECT COUNT(*) INTO v_eligible_members
  FROM team_quest_progress
  WHERE team_quest_id = p_team_quest_id
    AND progress_percent >= v_progress_threshold
    AND is_flagged = FALSE;

  -- Check if 70% of members have completed
  IF v_eligible_members::NUMERIC / NULLIF(v_total_members, 0) >= v_completion_threshold THEN
    -- Mark quest as completed
    UPDATE team_quests
    SET status = 'completed', completed_at = now()
    WHERE id = p_team_quest_id;

    -- Award XP to eligible members only
    UPDATE profiles
    SET xp = xp + v_xp_reward
    WHERE id IN (
      SELECT user_id FROM team_quest_progress
      WHERE team_quest_id = p_team_quest_id
        AND progress_percent >= v_progress_threshold
        AND is_flagged = FALSE
    );

    -- Update team streak
    INSERT INTO team_streaks (team_id, current_streak, longest_streak, last_completed_date)
    VALUES (v_team_id, 1, 1, CURRENT_DATE)
    ON CONFLICT (team_id) DO UPDATE
    SET 
      current_streak = CASE 
        WHEN team_streaks.last_completed_date = CURRENT_DATE - 1 THEN team_streaks.current_streak + 1
        WHEN team_streaks.last_completed_date = CURRENT_DATE THEN team_streaks.current_streak
        ELSE 1 
      END,
      longest_streak = GREATEST(
        team_streaks.longest_streak,
        CASE 
          WHEN team_streaks.last_completed_date = CURRENT_DATE - 1 THEN team_streaks.current_streak + 1
          ELSE 1 
        END
      ),
      last_completed_date = CURRENT_DATE,
      updated_at = now();

    -- Log to admin
    INSERT INTO admin_audit_logs (admin_id, action_type, details)
    VALUES (auth.uid(), 'TEAM_QUEST_COMPLETED', 
      jsonb_build_object('team_quest_id', p_team_quest_id, 'eligible', v_eligible_members, 'total', v_total_members));

    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- ============================================
-- 10. FUNCTION: ACCEPT TEAM QUEST (Admin Only)
-- ============================================
CREATE OR REPLACE FUNCTION public.accept_team_quest(
  p_team_id UUID,
  p_quest_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_team_quest_id UUID;
  v_member RECORD;
BEGIN
  v_user_id := auth.uid();
  
  -- Verify admin
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id 
    AND user_id = v_user_id
    AND role IN ('admin', 'creator')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only team admins can accept team quests');
  END IF;

  -- Check if already active
  IF EXISTS (
    SELECT 1 FROM team_quests
    WHERE team_id = p_team_id AND quest_id = p_quest_id AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quest already active for this team');
  END IF;

  -- Create team quest
  INSERT INTO team_quests (team_id, quest_id, created_by)
  VALUES (p_team_id, p_quest_id, v_user_id)
  RETURNING id INTO v_team_quest_id;

  -- Initialize progress for all members
  FOR v_member IN SELECT user_id FROM team_members WHERE team_id = p_team_id
  LOOP
    INSERT INTO team_quest_progress (team_quest_id, user_id, progress_percent)
    VALUES (v_team_quest_id, v_member.user_id, 0);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'team_quest_id', v_team_quest_id,
    'message', 'Team quest accepted! All members can now contribute.'
  );
END;
$$;

-- ============================================
-- 11. GRANTS
-- ============================================
GRANT EXECUTE ON FUNCTION public.update_team_quest_progress(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_team_quest_completion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_team_quest(UUID, UUID) TO authenticated;

-- Reload schema
NOTIFY pgrst, 'reload config';
