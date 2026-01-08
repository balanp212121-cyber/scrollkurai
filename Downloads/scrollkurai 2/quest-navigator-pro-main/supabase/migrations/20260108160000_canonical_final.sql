-- =============================================
-- CANONICAL POWER-UP SYSTEM MIGRATION (FINAL - PART 1: SCHEMA)
-- =============================================

-- 1. Update strategic_powerups table
ALTER TABLE public.strategic_powerups ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 1440;
ALTER TABLE public.strategic_powerups ADD COLUMN IF NOT EXISTS cooldown_minutes INTEGER DEFAULT 0;
ALTER TABLE public.strategic_powerups ADD COLUMN IF NOT EXISTS stackable BOOLEAN DEFAULT FALSE;

-- Migrate existing cooldown_days logic
UPDATE public.strategic_powerups
SET cooldown_minutes = cooldown_days * 24 * 60
WHERE cooldown_minutes = 0 AND cooldown_days > 0;

-- 2. RECREATE user_strategic_powerups
DROP TABLE IF EXISTS public.user_strategic_powerups CASCADE;

CREATE TABLE public.user_strategic_powerups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  powerup_id TEXT NOT NULL REFERENCES public.strategic_powerups(id) ON DELETE CASCADE,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  cooldown_until TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, powerup_id)
);

CREATE INDEX idx_user_powerups_lookup ON public.user_strategic_powerups(user_id, powerup_id);

-- 3. RLS
ALTER TABLE public.user_strategic_powerups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow powerup activation" ON public.user_strategic_powerups FOR INSERT WITH CHECK (user_id = auth.uid() OR auth.role() = 'service_role');
CREATE POLICY "Read own powerups" ON public.user_strategic_powerups FOR SELECT USING (user_id = auth.uid() OR auth.role() = 'service_role');
CREATE POLICY "Service manage powerups" ON public.user_strategic_powerups FOR ALL TO service_role USING (true);
