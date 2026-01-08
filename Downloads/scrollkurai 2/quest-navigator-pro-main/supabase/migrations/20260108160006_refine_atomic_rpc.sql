-- =============================================
-- REFINE ATOMIC RPC (ON CONFLICT PATTERN)
-- =============================================

CREATE OR REPLACE FUNCTION public.use_powerup_atomic(
  p_user_id UUID,
  p_powerup_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_expires_at TIMESTAMPTZ;
  v_cooldown_until TIMESTAMPTZ;
  v_powerup RECORD;
  v_existing RECORD;
BEGIN
  -- 1. Validate Power-Up
  SELECT * INTO v_powerup
  FROM public.strategic_powerups
  WHERE id = p_powerup_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'POWERUP_NOT_FOUND'
    );
  END IF;

  -- 2. Check Expiry/Cooldown (Read Phase with Lock)
  -- Locking is still useful to return precise error messages before attempting write
  SELECT * INTO v_existing
  FROM public.user_strategic_powerups
  WHERE user_id = p_user_id
    AND powerup_id = p_powerup_id
  FOR UPDATE; 

  -- Idempotent check: already active
  IF FOUND AND v_existing.expires_at > v_now THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'expires_at', v_existing.expires_at
    );
  END IF;

  -- Cooldown enforcement
  IF FOUND AND v_existing.cooldown_until > v_now THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'COOLDOWN_ACTIVE',
      'cooldown_until', v_existing.cooldown_until
    );
  END IF;

  -- 3. Calculate New Times
  v_expires_at := v_now + make_interval(mins => v_powerup.duration_minutes);
  v_cooldown_until := v_now + make_interval(mins => v_powerup.cooldown_minutes);

  -- 4. Insert or Update (Write Phase with Conflict Handling)
  -- This covers the race condition where a row was inserted after SELECT but before INSERT
  INSERT INTO public.user_strategic_powerups (
    user_id,
    powerup_id,
    activated_at,
    expires_at,
    cooldown_until,
    expiry_processed -- Reset flag
  )
  VALUES (
    p_user_id,
    p_powerup_id,
    v_now,
    v_expires_at,
    v_cooldown_until,
    FALSE
  )
  ON CONFLICT (user_id, powerup_id)
  DO UPDATE SET
    activated_at = EXCLUDED.activated_at,
    expires_at = EXCLUDED.expires_at,
    cooldown_until = EXCLUDED.cooldown_until,
    expiry_processed = FALSE;

  -- 5. Domain Event
  INSERT INTO public.domain_events (
    event_type,
    user_id,
    entity_type,
    entity_id,
    payload
  )
  VALUES (
    'powerup_activated',
    p_user_id,
    'strategic_powerup',
    gen_random_uuid(),
    jsonb_build_object(
      'powerup', p_powerup_id,
      'expires_at', v_expires_at
    )
  );

  -- 6. Return Success
  RETURN jsonb_build_object(
    'success', true,
    'expires_at', v_expires_at
  );
END;
$func$;

-- Ensure Permissions maintained

