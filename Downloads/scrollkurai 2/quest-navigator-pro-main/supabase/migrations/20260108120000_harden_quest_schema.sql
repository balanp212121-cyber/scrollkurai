-- =============================================
-- HARDENED QUEST SCHEMA MIGRATION
-- Adds status tracking, accept_quest_atomic, and domain events
-- =============================================

-- 1. Add status column to user_quest_log for explicit state machine
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_quest_log' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.user_quest_log 
    ADD COLUMN status TEXT DEFAULT 'active' 
    CHECK (status IN ('pending', 'active', 'completed'));
  END IF;
END $$;

-- 2. Add accepted_at timestamp
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_quest_log' 
    AND column_name = 'accepted_at'
  ) THEN
    ALTER TABLE public.user_quest_log 
    ADD COLUMN accepted_at TIMESTAMPTZ;
  END IF;
END $$;

-- 3. Backfill existing data
UPDATE public.user_quest_log
SET status = CASE 
  WHEN completed_at IS NOT NULL THEN 'completed'
  ELSE 'active'
END
WHERE status IS NULL;

UPDATE public.user_quest_log
SET accepted_at = assigned_at
WHERE accepted_at IS NULL AND status IN ('active', 'completed');

-- 4. Create domain_events table for audit trail
CREATE TABLE IF NOT EXISTS public.domain_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_domain_events_user_id ON public.domain_events(user_id);
CREATE INDEX IF NOT EXISTS idx_domain_events_entity ON public.domain_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_domain_events_type ON public.domain_events(event_type, created_at DESC);

-- RLS for domain_events
ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_events" ON public.domain_events;
CREATE POLICY "users_read_own_events" ON public.domain_events 
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "service_manage_events" ON public.domain_events;
CREATE POLICY "service_manage_events" ON public.domain_events 
  FOR ALL TO service_role USING (true);

-- 5. Create accept_quest_atomic RPC
CREATE OR REPLACE FUNCTION public.accept_quest_atomic(
  p_user_id UUID,
  p_log_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quest_log RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. LOCK and FETCH the quest log row
  SELECT * INTO v_quest_log
  FROM public.user_quest_log
  WHERE id = p_log_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Quest not found or does not belong to you',
      'error_code', 'QUEST_NOT_FOUND'
    );
  END IF;

  -- 2. IDEMPOTENCY CHECK: If already active or completed, return success
  IF v_quest_log.status IN ('active', 'completed') THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'status', v_quest_log.status,
      'accepted_at', v_quest_log.accepted_at,
      'message', 'Quest already accepted'
    );
  END IF;

  -- 3. TRANSITION: pending -> active
  UPDATE public.user_quest_log
  SET 
    status = 'active',
    accepted_at = v_now
  WHERE id = p_log_id;

  -- 4. EMIT DOMAIN EVENT
  INSERT INTO public.domain_events (event_type, user_id, entity_type, entity_id, payload)
  VALUES (
    'quest_accepted',
    p_user_id,
    'user_quest_log',
    p_log_id,
    jsonb_build_object(
      'quest_id', v_quest_log.quest_id,
      'accepted_at', v_now
    )
  );

  -- 5. RETURN SUCCESS
  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'status', 'active',
    'accepted_at', v_now,
    'quest_id', v_quest_log.quest_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to accept quest',
      'error_code', 'INTERNAL_ERROR',
      'details', SQLERRM
    );
END;
$$;

-- 6. Update complete_quest_atomic to require 'active' status
CREATE OR REPLACE FUNCTION public.complete_quest_atomic(
    p_user_id UUID,
    p_log_id UUID,
    p_reflection_text TEXT,
    p_is_golden_quest BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_quest_log RECORD;
    v_profile RECORD;
    v_today DATE := CURRENT_DATE;
    v_yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
    v_new_streak INT;
    v_streak_lost_at TIMESTAMPTZ := NULL;
    v_last_streak_count INT := NULL;
    v_base_xp INT := 250;
    v_streak_bonus INT;
    v_total_xp INT;
    v_new_total_xp INT;
    v_new_level INT;
    v_xp_booster_applied BOOLEAN := FALSE;
    v_streak_freeze_used BOOLEAN := FALSE;
    v_streak_freeze_active BOOLEAN;
    v_streak_freeze_expires_at TIMESTAMPTZ;
    v_xp_booster_active BOOLEAN;
    v_xp_booster_started_at TIMESTAMPTZ;
    v_xp_booster_expires_at TIMESTAMPTZ;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- 1. LOCK and VERIFY QUEST LOG EXISTS AND BELONGS TO USER
    SELECT * INTO v_quest_log
    FROM public.user_quest_log
    WHERE id = p_log_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Quest not found or does not belong to you',
            'error_code', 'QUEST_NOT_FOUND'
        );
    END IF;

    -- 2. IDEMPOTENCY CHECK: If already completed, return success
    IF v_quest_log.status = 'completed' THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'xp_awarded', COALESCE(v_quest_log.xp_awarded, 0),
            'message', 'Quest already completed'
        );
    END IF;

    -- 3. PRECONDITION: Quest must be in 'active' status
    IF v_quest_log.status != 'active' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Quest must be accepted before completing',
            'error_code', 'QUEST_NOT_ACTIVE',
            'current_status', v_quest_log.status
        );
    END IF;

    -- 4. GET CURRENT PROFILE (with lock)
    SELECT * INTO v_profile
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Profile not found',
            'error_code', 'PROFILE_NOT_FOUND'
        );
    END IF;

    -- 5. HANDLE STREAK FREEZE EXPIRY
    v_streak_freeze_active := v_profile.streak_freeze_active;
    v_streak_freeze_expires_at := v_profile.streak_freeze_expires_at;

    IF v_streak_freeze_active AND v_streak_freeze_expires_at IS NOT NULL THEN
        IF v_now >= v_streak_freeze_expires_at THEN
            v_streak_freeze_active := FALSE;
            v_streak_freeze_expires_at := NULL;
        END IF;
    END IF;

    -- 6. CALCULATE STREAK
    IF v_profile.last_quest_date IS NULL THEN
        v_new_streak := 1;
        v_streak_lost_at := NULL;
        v_last_streak_count := NULL;
    ELSIF v_profile.last_quest_date = v_yesterday THEN
        v_new_streak := v_profile.streak + 1;
        v_streak_lost_at := NULL;
        v_last_streak_count := NULL;
    ELSIF v_profile.last_quest_date = v_today THEN
        v_new_streak := v_profile.streak;
    ELSE
        IF v_streak_freeze_active THEN
            v_new_streak := v_profile.streak + 1;
            v_streak_freeze_active := FALSE;
            v_streak_freeze_expires_at := NULL;
            v_streak_freeze_used := TRUE;
        ELSE
            IF v_profile.streak > 1 THEN
                v_streak_lost_at := v_now;
                v_last_streak_count := v_profile.streak;
            END IF;
            v_new_streak := 1;
        END IF;
    END IF;

    -- 7. CALCULATE XP
    v_streak_bonus := v_new_streak * 10;
    v_total_xp := v_base_xp + v_streak_bonus;

    v_xp_booster_active := v_profile.xp_booster_active;
    v_xp_booster_started_at := v_profile.xp_booster_started_at;
    v_xp_booster_expires_at := v_profile.xp_booster_expires_at;

    IF v_xp_booster_active AND v_xp_booster_expires_at IS NOT NULL THEN
        IF v_now < v_xp_booster_expires_at THEN
            v_total_xp := v_total_xp * 2;
            v_xp_booster_applied := TRUE;
        ELSE
            v_xp_booster_active := FALSE;
            v_xp_booster_started_at := NULL;
            v_xp_booster_expires_at := NULL;
        END IF;
    END IF;

    IF p_is_golden_quest THEN
        v_total_xp := v_total_xp * 3;
    END IF;

    v_new_total_xp := v_profile.xp + v_total_xp;
    v_new_level := FLOOR(v_new_total_xp / 1000) + 1;

    -- 8. UPDATE QUEST LOG (ATOMIC)
    UPDATE public.user_quest_log
    SET
        status = 'completed',
        completed_at = v_now,
        reflection_text = p_reflection_text,
        xp_awarded = v_total_xp
    WHERE id = p_log_id;

    -- 9. UPDATE PROFILE (ATOMIC)
    UPDATE public.profiles
    SET
        xp = v_new_total_xp,
        level = v_new_level,
        streak = v_new_streak,
        last_quest_date = v_today,
        total_quests_completed = total_quests_completed + 1,
        streak_lost_at = v_streak_lost_at,
        last_streak_count = v_last_streak_count,
        xp_booster_active = v_xp_booster_active,
        xp_booster_started_at = v_xp_booster_started_at,
        xp_booster_expires_at = v_xp_booster_expires_at,
        streak_freeze_active = v_streak_freeze_active,
        streak_freeze_expires_at = v_streak_freeze_expires_at
    WHERE id = p_user_id;

    -- 10. EMIT DOMAIN EVENT
    INSERT INTO public.domain_events (event_type, user_id, entity_type, entity_id, payload)
    VALUES (
      'quest_completed',
      p_user_id,
      'user_quest_log',
      p_log_id,
      jsonb_build_object(
        'quest_id', v_quest_log.quest_id,
        'xp_awarded', v_total_xp,
        'streak', v_new_streak,
        'level', v_new_level,
        'xp_booster_applied', v_xp_booster_applied,
        'streak_freeze_used', v_streak_freeze_used,
        'is_golden_quest', p_is_golden_quest
      )
    );

    -- 11. RETURN SUCCESS
    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'xp_awarded', v_total_xp,
        'streak', v_new_streak,
        'total_xp', v_new_total_xp,
        'level', v_new_level,
        'xp_booster_applied', v_xp_booster_applied,
        'streak_freeze_used', v_streak_freeze_used
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Something went wrong, your streak is safe. Please try again.',
            'error_code', 'INTERNAL_ERROR',
            'details', SQLERRM
        );
END;
$$;

-- 7. Create use_powerup_atomic RPC (wraps activate_strategic_powerup with idempotency)
CREATE OR REPLACE FUNCTION public.use_powerup_atomic(
  p_user_id UUID,
  p_powerup_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_powerup RECORD;
  v_existing RECORD;
  v_today DATE := CURRENT_DATE;
  v_cooldown_end DATE;
BEGIN
  -- 1. Validate powerup exists
  SELECT * INTO v_powerup 
  FROM public.strategic_powerups 
  WHERE id = p_powerup_id AND active = TRUE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Power-up not found or inactive',
      'error_code', 'POWERUP_NOT_FOUND'
    );
  END IF;

  -- 2. Check for existing active usage today (IDEMPOTENCY)
  SELECT * INTO v_existing
  FROM public.user_strategic_powerups
  WHERE user_id = p_user_id
    AND powerup_id = p_powerup_id
    AND activated_at::DATE = v_today
  FOR UPDATE;

  IF FOUND THEN
    -- Already activated today - return success (idempotent)
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'powerup', jsonb_build_object(
        'name', v_powerup.name,
        'icon', v_powerup.icon,
        'effect', v_powerup.effect,
        'activated_at', v_existing.activated_at,
        'expires_at', v_existing.expires_at
      ),
      'message', 'Power-up already active for today'
    );
  END IF;

  -- 3. Check cooldown from previous usage
  SELECT (activated_at::DATE + v_powerup.cooldown_days) INTO v_cooldown_end
  FROM public.user_strategic_powerups
  WHERE user_id = p_user_id
    AND powerup_id = p_powerup_id
  ORDER BY activated_at DESC
  LIMIT 1;

  IF v_cooldown_end IS NOT NULL AND v_today < v_cooldown_end THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Power-up is on cooldown',
      'error_code', 'COOLDOWN_ACTIVE',
      'available_at', v_cooldown_end
    );
  END IF;

  -- 4. Activate power-up
  INSERT INTO public.user_strategic_powerups (user_id, powerup_id, expires_at, outcome)
  VALUES (p_user_id, p_powerup_id, NOW() + INTERVAL '24 hours', 'pending');

  -- 5. Emit domain event
  INSERT INTO public.domain_events (event_type, user_id, entity_type, entity_id, payload)
  VALUES (
    'powerup_activated',
    p_user_id,
    'strategic_powerup',
    gen_random_uuid(), -- Use a new UUID for the usage record
    jsonb_build_object(
      'powerup_id', p_powerup_id,
      'powerup_name', v_powerup.name,
      'effect', v_powerup.effect
    )
  );

  -- 6. Return success
  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'powerup', jsonb_build_object(
      'name', v_powerup.name,
      'icon', v_powerup.icon,
      'effect', v_powerup.effect
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to activate power-up',
      'error_code', 'INTERNAL_ERROR',
      'details', SQLERRM
    );
END;
$$;

-- 8. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.accept_quest_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_quest_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_powerup_atomic TO authenticated;
