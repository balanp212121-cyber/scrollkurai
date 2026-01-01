-- Monetization Features: Power-Up Purchases & Streak Shields

-- 1. Power-Up Purchases Table
CREATE TABLE IF NOT EXISTS public.power_up_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  quantity INTEGER NOT NULL,
  price_inr INTEGER NOT NULL,
  payment_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add extra_power_ups to profiles if not exists
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS extra_power_ups INTEGER DEFAULT 0;

-- 3. Streak Shields Table
CREATE TABLE IF NOT EXISTS public.streak_shields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  duration_days INTEGER NOT NULL,
  price_inr INTEGER NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  streak_restored INTEGER
);

-- 4. RLS for power_up_purchases
ALTER TABLE public.power_up_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_purchases" ON public.power_up_purchases;
CREATE POLICY "users_read_own_purchases" ON public.power_up_purchases
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "service_insert_purchases" ON public.power_up_purchases;
CREATE POLICY "service_insert_purchases" ON public.power_up_purchases
  FOR INSERT TO service_role
  WITH CHECK (true);

-- 5. RLS for streak_shields
ALTER TABLE public.streak_shields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_shields" ON public.streak_shields;
CREATE POLICY "users_read_own_shields" ON public.streak_shields
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "service_insert_shields" ON public.streak_shields;
CREATE POLICY "service_insert_shields" ON public.streak_shields
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_update_shields" ON public.streak_shields;
CREATE POLICY "service_update_shields" ON public.streak_shields
  FOR UPDATE TO service_role
  USING (true);

-- 6. RPC to get active shield
CREATE OR REPLACE FUNCTION public.get_active_shield(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
  id UUID,
  duration_days INTEGER,
  expires_at TIMESTAMPTZ,
  days_remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ss.id,
    ss.duration_days,
    ss.expires_at,
    GREATEST(0, EXTRACT(DAY FROM ss.expires_at - NOW())::INTEGER) as days_remaining
  FROM public.streak_shields ss
  WHERE ss.user_id = p_user_id
    AND ss.expires_at > NOW()
    AND ss.used_at IS NULL
  ORDER BY ss.expires_at DESC
  LIMIT 1;
END;
$$;

-- 7. RPC to get global leaderboard (LIMITED TO 50)
CREATE OR REPLACE FUNCTION public.get_global_leaderboard()
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  xp INTEGER,
  level INTEGER,
  rank INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.username,
    p.xp,
    p.level,
    CAST(ROW_NUMBER() OVER (ORDER BY p.xp DESC) AS INTEGER) as rank
  FROM profiles p
  WHERE p.username IS NOT NULL
  ORDER BY p.xp DESC
  LIMIT 50;
END;
$$;

-- 8. RPC to get user's global rank (for users outside top 50)
CREATE OR REPLACE FUNCTION public.get_user_global_rank(p_user_id UUID DEFAULT auth.uid())
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_rank INTEGER;
BEGIN
  SELECT ranked.rank INTO user_rank
  FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY xp DESC) as rank
    FROM profiles
    WHERE username IS NOT NULL
  ) ranked
  WHERE ranked.id = p_user_id;
  
  RETURN COALESCE(user_rank, 0);
END;
$$;
