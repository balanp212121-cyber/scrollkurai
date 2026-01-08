-- Legacy Migration: Strategic Power-Ups (Cleaned Up)
-- Fixed syntax errors and removed broken dependencies from original file.

-- 1. Strategic Power-Ups Definition Table
CREATE TABLE IF NOT EXISTS public.strategic_powerups (
  id TEXT PRIMARY KEY, -- e.g. 'blood_oath', 'shadow_clone'
  name TEXT NOT NULL,
  icon TEXT NOT NULL, -- Lucide icon name
  description TEXT NOT NULL,
  effect JSONB NOT NULL, -- e.g. { "xp_multiplier": 3, "streak_protection": true }
  cooldown_days INTEGER NOT NULL DEFAULT 7,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Power-Ups
INSERT INTO public.strategic_powerups (id, name, icon, description, effect, cooldown_days) VALUES
('blood_oath', 'Blood Oath', 'sword', 'Triple XP for the next quest, but if you fail, you lose your streak immediately.', '{"xp_multiplier": 3, "risk": "streak_wipe"}', 7),
('shadow_clone', 'Shadow Clone', 'copy', 'Complete two quests in one day. The second one counts for 50% XP.', '{"extra_quest": true}', 3),
('time_dilation', 'Time Dilation', 'clock', 'Extend the daily deadline by 12 hours.', '{"deadline_extension": 720}', 14),
('phoenix_flame', 'Phoenix Flame', 'flame', 'Resurrect a lost streak from the last 24 hours.', '{"streak_restore": true}', 30)
ON CONFLICT (id) DO UPDATE SET
  effect = EXCLUDED.effect,
  cooldown_days = EXCLUDED.cooldown_days;

-- 2. User Strategic Power-Up Usage
CREATE TABLE IF NOT EXISTS public.user_strategic_powerups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  powerup_id TEXT NOT NULL REFERENCES public.strategic_powerups(id),
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  outcome TEXT CHECK (outcome IN ('pending', 'success', 'failed')),
  outcome_at TIMESTAMPTZ
  -- UNIQUE constraint removed for validity. Handled by later migration.
);
-- Index added safely
CREATE INDEX IF NOT EXISTS idx_user_strategic_powerups_lookup ON public.user_strategic_powerups (user_id, powerup_id);


-- 5. RPC: Activate Strategic Power-Up (Legacy Version - Will be superseded)
CREATE OR REPLACE FUNCTION public.activate_strategic_powerup(p_powerup_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id UUID;
  powerup RECORD;
  last_use DATE;
BEGIN
  user_id := auth.uid();
  
  -- Get power-up
  SELECT * INTO powerup FROM strategic_powerups WHERE id = p_powerup_id AND active = TRUE;
  IF powerup IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'Power-up not found');
  END IF;
  
  -- Check cooldown (Legacy Logic)
  SELECT activated_at::DATE INTO last_use
  FROM user_strategic_powerups
  WHERE user_strategic_powerups.user_id = activate_strategic_powerup.user_id
    AND powerup_id = p_powerup_id
  ORDER BY activated_at DESC LIMIT 1;
  
  IF last_use IS NOT NULL AND last_use > CURRENT_DATE - powerup.cooldown_days THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'Cooldown active', 
      'available_at', last_use + powerup.cooldown_days);
  END IF;
  
  -- Activate
  INSERT INTO user_strategic_powerups (user_id, powerup_id, expires_at, outcome)
  VALUES (user_id, p_powerup_id, NOW() + INTERVAL '24 hours', 'pending');
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'powerup', jsonb_build_object(
      'name', powerup.name,
      'icon', powerup.icon,
      'effect', powerup.effect
    )
  );
END;
$$;


-- 8. RPC: Get Active Power-Ups
CREATE OR REPLACE FUNCTION public.get_active_strategic_powerups(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
  powerup_id TEXT,
  name TEXT,
  icon TEXT,
  effect JSONB,
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  outcome TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    usp.powerup_id,
    sp.name,
    sp.icon,
    sp.effect,
    usp.activated_at,
    usp.expires_at,
    usp.outcome
  FROM user_strategic_powerups usp
  JOIN strategic_powerups sp ON sp.id = usp.powerup_id
  WHERE usp.user_id = p_user_id
    AND (usp.expires_at > NOW() OR usp.outcome = 'pending')
  ORDER BY usp.activated_at DESC;
END;
$$;

-- 9. RLS
ALTER TABLE public.strategic_powerups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_strategic_powerups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_powerups" ON public.strategic_powerups;
CREATE POLICY "public_read_powerups" ON public.strategic_powerups FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "users_read_own_powerup_usage" ON public.user_strategic_powerups;
CREATE POLICY "users_read_own_powerup_usage" ON public.user_strategic_powerups FOR SELECT TO authenticated USING (user_id = auth.uid());


-- 10. Grants
GRANT EXECUTE ON FUNCTION public.activate_strategic_powerup TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_strategic_powerups TO authenticated;
