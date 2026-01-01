-- Rare Avatar Drops System
-- This migration adds support for rare avatar drops as rewards

-- Avatar catalog (defines all droppable avatars and their rarity)
CREATE TABLE IF NOT EXISTS public.avatar_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  preset_id TEXT NOT NULL UNIQUE,
  emoji TEXT NOT NULL DEFAULT '🎭',
  bg_color TEXT NOT NULL DEFAULT 'from-purple-500 to-indigo-500',
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  drop_chance DECIMAL(6,5) NOT NULL DEFAULT 0.05 CHECK (drop_chance >= 0 AND drop_chance <= 1),
  is_droppable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User's unlocked avatar collection
CREATE TABLE IF NOT EXISTS public.user_avatar_collection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_id UUID NOT NULL REFERENCES public.avatar_catalog(id) ON DELETE CASCADE,
  dropped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('quest', 'streak', 'referral', 'admin', 'purchase')),
  is_equipped BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(user_id, avatar_id)
);

-- Drop cooldown tracking (prevents spam drops)
CREATE TABLE IF NOT EXISTS public.avatar_drop_cooldowns (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_rare_drop_at TIMESTAMPTZ,
  cooldown_until TIMESTAMPTZ,
  total_drops INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.avatar_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_avatar_collection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avatar_drop_cooldowns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view avatar catalog" 
  ON public.avatar_catalog FOR SELECT 
  USING (true);

CREATE POLICY "Users can view own avatar collection" 
  ON public.user_avatar_collection FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert avatar collection" 
  ON public.user_avatar_collection FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own collection (equip)" 
  ON public.user_avatar_collection FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own cooldown" 
  ON public.avatar_drop_cooldowns FOR SELECT 
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_avatar_catalog_rarity ON public.avatar_catalog(rarity);
CREATE INDEX IF NOT EXISTS idx_avatar_catalog_droppable ON public.avatar_catalog(is_droppable);
CREATE INDEX IF NOT EXISTS idx_user_avatar_collection_user ON public.user_avatar_collection(user_id);

-- Seed rare avatars
INSERT INTO public.avatar_catalog (name, preset_id, emoji, bg_color, rarity, drop_chance) VALUES
  -- Rare (5% each)
  ('Mystic Guardian', 'mystic_guardian', '🔮', 'from-violet-600 to-purple-700', 'rare', 0.05),
  ('Shadow Walker', 'shadow_walker', '🌑', 'from-slate-700 to-zinc-900', 'rare', 0.05),
  ('Storm Chaser', 'storm_chaser', '⚡', 'from-yellow-500 to-orange-600', 'rare', 0.05),
  -- Epic (1% each)
  ('Crystal Sage', 'crystal_sage', '💎', 'from-cyan-400 to-blue-600', 'epic', 0.01),
  ('Dragon Spirit', 'dragon_spirit', '🐉', 'from-red-600 to-orange-700', 'epic', 0.01),
  ('Frost Monarch', 'frost_monarch', '❄️', 'from-blue-300 to-cyan-500', 'epic', 0.01),
  -- Legendary (0.1% each)
  ('Celestial Phoenix', 'celestial_phoenix', '🦅', 'from-amber-400 to-red-600', 'legendary', 0.001),
  ('Void Emperor', 'void_emperor', '👑', 'from-purple-900 to-black', 'legendary', 0.001)
ON CONFLICT (preset_id) DO NOTHING;

-- Function to roll for avatar drop (called from Edge Function)
CREATE OR REPLACE FUNCTION public.roll_avatar_drop(p_user_id UUID, p_trigger TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cooldown_until TIMESTAMPTZ;
  v_roll DECIMAL;
  v_avatar RECORD;
  v_result JSONB;
BEGIN
  -- 1. Check cooldown
  SELECT cooldown_until INTO v_cooldown_until
  FROM avatar_drop_cooldowns
  WHERE user_id = p_user_id;

  IF v_cooldown_until IS NOT NULL AND v_cooldown_until > now() THEN
    RETURN jsonb_build_object('dropped', false, 'reason', 'cooldown');
  END IF;

  -- 2. Get random droppable avatar user doesn't have
  SELECT ac.* INTO v_avatar
  FROM avatar_catalog ac
  LEFT JOIN user_avatar_collection uac ON ac.id = uac.avatar_id AND uac.user_id = p_user_id
  WHERE ac.is_droppable = true
    AND uac.id IS NULL
  ORDER BY random()
  LIMIT 1;

  IF v_avatar IS NULL THEN
    RETURN jsonb_build_object('dropped', false, 'reason', 'no_available');
  END IF;

  -- 3. Roll the dice (server-side RNG)
  v_roll := random();

  IF v_roll > v_avatar.drop_chance THEN
    RETURN jsonb_build_object('dropped', false, 'reason', 'roll_failed', 'roll', v_roll, 'needed', v_avatar.drop_chance);
  END IF;

  -- 4. Grant the avatar!
  INSERT INTO user_avatar_collection (user_id, avatar_id, trigger_type)
  VALUES (p_user_id, v_avatar.id, p_trigger)
  ON CONFLICT (user_id, avatar_id) DO NOTHING;

  -- 5. Set cooldown for rare+ drops (30 days)
  IF v_avatar.rarity IN ('rare', 'epic', 'legendary') THEN
    INSERT INTO avatar_drop_cooldowns (user_id, last_rare_drop_at, cooldown_until, total_drops)
    VALUES (p_user_id, now(), now() + interval '30 days', 1)
    ON CONFLICT (user_id) DO UPDATE SET
      last_rare_drop_at = now(),
      cooldown_until = now() + interval '30 days',
      total_drops = avatar_drop_cooldowns.total_drops + 1;
  END IF;

  -- 6. Return success
  RETURN jsonb_build_object(
    'dropped', true,
    'avatar', jsonb_build_object(
      'id', v_avatar.id,
      'name', v_avatar.name,
      'preset_id', v_avatar.preset_id,
      'emoji', v_avatar.emoji,
      'bg_color', v_avatar.bg_color,
      'rarity', v_avatar.rarity
    )
  );
END;
$$;

-- Grant execute to authenticated users (called via RPC)
GRANT EXECUTE ON FUNCTION public.roll_avatar_drop TO authenticated;
GRANT EXECUTE ON FUNCTION public.roll_avatar_drop TO service_role;
