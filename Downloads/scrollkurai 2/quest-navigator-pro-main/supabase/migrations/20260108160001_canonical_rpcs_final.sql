-- =============================================
-- CANONICAL POWER-UP SYSTEM MIGRATION (FINAL - PART 2a: Use RPC)
-- =============================================

-- 4. RPC: use_powerup_atomic
CREATE OR REPLACE FUNCTION public.use_powerup_atomic(
  p_user_id UUID,
  p_powerup_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_powerup RECORD;
  v_existing RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_expires_at TIMESTAMPTZ;
  v_cooldown_until TIMESTAMPTZ;
BEGIN
  -- 1. GET POWERUP CONFIG
  SELECT * INTO v_powerup
  FROM public.strategic_powerups
  WHERE id = p_powerup_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Power-up not found', 'error_code', 'POWERUP_NOT_FOUND');
  END IF;

  -- 2. CALCULATE TIMES
  v_expires_at := v_now + (v_powerup.duration_minutes || ' minutes')::INTERVAL;
  v_cooldown_until := v_now + (v_powerup.cooldown_minutes || ' minutes')::INTERVAL;

  -- 3. CHECK EXISTING STATE (Row Locking)
  SELECT * INTO v_existing
  FROM public.user_strategic_powerups
  WHERE user_id = p_user_id AND powerup_id = p_powerup_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.expires_at > v_now THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'status', 'active', 'expires_at', v_existing.expires_at, 'powerup', jsonb_build_object('name', v_powerup.name, 'effect', v_powerup.effect));
    END IF;

    IF v_existing.cooldown_until > v_now THEN
       RETURN jsonb_build_object('success', false, 'error', 'Power-up is on cooldown', 'error_code', 'COOLDOWN_ACTIVE', 'available_at', v_existing.cooldown_until);
    END IF;

    UPDATE public.user_strategic_powerups
    SET activated_at = v_now, expires_at = v_expires_at, cooldown_until = v_cooldown_until
    WHERE id = v_existing.id;
  ELSE
    INSERT INTO public.user_strategic_powerups (user_id, powerup_id, activated_at, expires_at, cooldown_until)
    VALUES (p_user_id, p_powerup_id, v_now, v_expires_at, v_cooldown_until);
  END IF;

  -- 4. EMIT EVENT
  INSERT INTO public.domain_events (event_type, user_id, entity_type, entity_id, payload)
  VALUES ('powerup_activated', p_user_id, 'strategic_powerup', gen_random_uuid(), jsonb_build_object('powerup_id', p_powerup_id, 'activated_at', v_now, 'expires_at', v_expires_at, 'cooldown_minutes', v_powerup.cooldown_minutes));

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'status', 'activated', 'expires_at', v_expires_at, 'powerup', jsonb_build_object('name', v_powerup.name, 'effect', v_powerup.effect));
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transactions failed', 'error_code', 'INTERNAL_ERROR', 'details', SQLERRM);
END;
$func$;


