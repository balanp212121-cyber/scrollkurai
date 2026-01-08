-- =============================================
-- POWER-UP EXPIRY WORKER & TIMELINE VIEW
-- =============================================

-- 1. Add expiry processing flag
ALTER TABLE public.user_strategic_powerups 
ADD COLUMN IF NOT EXISTS expiry_processed BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_user_powerups_expiry 
ON public.user_strategic_powerups(expires_at) 
WHERE expiry_processed = FALSE;

-- 2. Worker Function
CREATE OR REPLACE FUNCTION public.expire_powerups_worker()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row RECORD;
BEGIN
  -- Process expired but unprocessed powerups
  FOR v_row IN
    SELECT *
    FROM public.user_strategic_powerups
    WHERE expires_at <= NOW() 
      AND expiry_processed = FALSE
  LOOP
    -- Emit domain event
    INSERT INTO public.domain_events (
      event_type,
      user_id,
      entity_type,
      entity_id,
      payload
    )
    VALUES (
      'powerup_expired',
      v_row.user_id,
      'user_strategic_powerups',
      v_row.id,
      jsonb_build_object(
        'powerup_id', v_row.powerup_id,
        'expired_at', v_row.expires_at
      )
    );

    -- Mark as processed
    UPDATE public.user_strategic_powerups
    SET expiry_processed = TRUE
    WHERE id = v_row.id;
  END LOOP;
END;
$$;

-- 3. Schedule Worker (Attempt pg_cron)
-- Note: This requires pg_cron extension. 
-- Wrapped in DO block to avoid error if extension missing/unsupported in this context
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'expire-powerups-every-minute',
      '* * * * *',
      'SELECT public.expire_powerups_worker()'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Logging or ignoring if cron not available
  RAISE NOTICE 'pg_cron scheduling skipped or failed: %', SQLERRM;
END $$;


-- 4. Timeline View
CREATE OR REPLACE VIEW public.powerup_state_view AS
SELECT
  usp.user_id,
  usp.powerup_id,
  sp.name as powerup_name,
  usp.activated_at,
  usp.expires_at,
  usp.cooldown_until,
  CASE
    WHEN usp.expires_at > NOW() THEN 'active'
    WHEN usp.cooldown_until > NOW() THEN 'cooldown'
    ELSE 'available' -- Note: This means available for THIS user row history. True availability checks latest state.
  END AS state
FROM public.user_strategic_powerups usp
JOIN public.strategic_powerups sp ON usp.powerup_id = sp.id;

-- Grant access to view
GRANT SELECT ON public.powerup_state_view TO authenticated;
