-- Push Notifications & Streak Rewards System

-- 1. Notification Logs (with rate limiting)
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered BOOLEAN DEFAULT FALSE,
  clicked BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_user_sent 
ON public.notification_logs(user_id, sent_at);

-- 2. Notification Preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id),
  push_enabled BOOLEAN DEFAULT TRUE,
  streak_reminders BOOLEAN DEFAULT TRUE,
  purchase_alerts BOOLEAN DEFAULT TRUE,
  positive_reinforcement BOOLEAN DEFAULT TRUE,
  silent_start_hour INTEGER DEFAULT 23, -- 11 PM
  silent_end_hour INTEGER DEFAULT 7, -- 7 AM
  timezone TEXT DEFAULT 'Asia/Kolkata',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Reward Grants (idempotent, logged)
CREATE TABLE IF NOT EXISTS public.reward_grants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  reward_type TEXT NOT NULL, -- 'discount_7day', 'triple_quest_10day', 'surprise_powerup', etc.
  reward_value JSONB, -- {"discount_percent": 20} or {"power_ups": 1}
  trigger_streak INTEGER, -- streak count that triggered this
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  UNIQUE(user_id, reward_type, trigger_streak) -- Prevent duplicate grants
);

CREATE INDEX IF NOT EXISTS idx_reward_grants_user_active
ON public.reward_grants(user_id, expires_at) WHERE used_at IS NULL;

-- 4. Discount Coupons
CREATE TABLE IF NOT EXISTS public.discount_coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  code TEXT NOT NULL,
  discount_percent INTEGER NOT NULL DEFAULT 20,
  applies_to TEXT[] DEFAULT ARRAY['power_up', 'streak_shield', 'premium', 'counselling'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  min_amount_inr INTEGER DEFAULT 0,
  UNIQUE(user_id, code)
);

-- 5. RLS Policies
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_coupons ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "users_read_own_notifications" ON public.notification_logs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Users can read/update their preferences
CREATE POLICY "users_manage_preferences" ON public.notification_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid());

-- Users can read their rewards
CREATE POLICY "users_read_own_rewards" ON public.reward_grants
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Users can read their coupons
CREATE POLICY "users_read_own_coupons" ON public.discount_coupons
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Service role can insert/update all
CREATE POLICY "service_manage_notifications" ON public.notification_logs
  FOR ALL TO service_role USING (true);

CREATE POLICY "service_manage_rewards" ON public.reward_grants
  FOR ALL TO service_role USING (true);

CREATE POLICY "service_manage_coupons" ON public.discount_coupons
  FOR ALL TO service_role USING (true);

-- 6. RPC: Check notification rate limits
CREATE OR REPLACE FUNCTION public.can_send_notification(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  daily_count INTEGER;
  weekly_count INTEGER;
  prefs RECORD;
  current_hour INTEGER;
BEGIN
  -- Get user preferences
  SELECT * INTO prefs FROM notification_preferences WHERE user_id = p_user_id;
  
  -- Check if notifications enabled
  IF prefs IS NOT NULL AND NOT prefs.push_enabled THEN
    RETURN FALSE;
  END IF;
  
  -- Check silent hours (IST)
  current_hour := EXTRACT(HOUR FROM NOW() AT TIME ZONE COALESCE(prefs.timezone, 'Asia/Kolkata'));
  IF prefs IS NOT NULL AND (
    (prefs.silent_start_hour > prefs.silent_end_hour AND (current_hour >= prefs.silent_start_hour OR current_hour < prefs.silent_end_hour))
    OR (prefs.silent_start_hour <= prefs.silent_end_hour AND current_hour >= prefs.silent_start_hour AND current_hour < prefs.silent_end_hour)
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Count daily notifications
  SELECT COUNT(*) INTO daily_count
  FROM notification_logs
  WHERE user_id = p_user_id AND sent_at > NOW() - INTERVAL '24 hours';
  
  IF daily_count >= 2 THEN
    RETURN FALSE;
  END IF;
  
  -- Count weekly notifications
  SELECT COUNT(*) INTO weekly_count
  FROM notification_logs
  WHERE user_id = p_user_id AND sent_at > NOW() - INTERVAL '7 days';
  
  IF weekly_count >= 10 THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- 7. RPC: Grant streak reward (idempotent)
CREATE OR REPLACE FUNCTION public.grant_streak_reward(
  p_user_id UUID,
  p_streak_count INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  reward_type TEXT;
  reward_value JSONB;
  expires_at TIMESTAMPTZ;
  coupon_code TEXT;
  existing_grant UUID;
BEGIN
  -- 7-day streak: 20% discount coupon
  IF p_streak_count = 7 THEN
    reward_type := 'discount_7day';
    reward_value := jsonb_build_object('discount_percent', 20);
    expires_at := NOW() + INTERVAL '72 hours';
    coupon_code := 'STREAK7-' || SUBSTRING(gen_random_uuid()::TEXT, 1, 8);
    
    -- Check if already granted
    SELECT id INTO existing_grant FROM reward_grants
    WHERE user_id = p_user_id AND reward_type = 'discount_7day' AND trigger_streak = 7;
    
    IF existing_grant IS NULL THEN
      -- Create coupon
      INSERT INTO discount_coupons (user_id, code, discount_percent, expires_at)
      VALUES (p_user_id, coupon_code, 20, expires_at);
      
      -- Log reward
      INSERT INTO reward_grants (user_id, reward_type, reward_value, trigger_streak, expires_at)
      VALUES (p_user_id, reward_type, reward_value, p_streak_count, expires_at);
      
      RETURN jsonb_build_object(
        'granted', TRUE,
        'type', reward_type,
        'value', reward_value,
        'coupon_code', coupon_code,
        'expires_at', expires_at
      );
    END IF;
  
  -- 10-day streak: Triple quest unlock
  ELSIF p_streak_count = 10 THEN
    reward_type := 'triple_quest_10day';
    reward_value := jsonb_build_object('extra_quests', 3);
    expires_at := NOW() + INTERVAL '24 hours';
    
    SELECT id INTO existing_grant FROM reward_grants
    WHERE user_id = p_user_id AND reward_type = 'triple_quest_10day' AND trigger_streak = 10;
    
    IF existing_grant IS NULL THEN
      INSERT INTO reward_grants (user_id, reward_type, reward_value, trigger_streak, expires_at)
      VALUES (p_user_id, reward_type, reward_value, p_streak_count, expires_at);
      
      RETURN jsonb_build_object(
        'granted', TRUE,
        'type', reward_type,
        'value', reward_value,
        'expires_at', expires_at
      );
    END IF;
  END IF;
  
  RETURN jsonb_build_object('granted', FALSE, 'reason', 'already_granted_or_not_eligible');
END;
$$;

-- 8. RPC: Get active rewards
CREATE OR REPLACE FUNCTION public.get_active_rewards(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
  id UUID,
  reward_type TEXT,
  reward_value JSONB,
  expires_at TIMESTAMPTZ,
  hours_remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rg.id,
    rg.reward_type,
    rg.reward_value,
    rg.expires_at,
    GREATEST(0, EXTRACT(EPOCH FROM rg.expires_at - NOW()) / 3600)::INTEGER as hours_remaining
  FROM reward_grants rg
  WHERE rg.user_id = p_user_id
    AND rg.expires_at > NOW()
    AND rg.used_at IS NULL
  ORDER BY rg.expires_at ASC;
END;
$$;

-- 9. RPC: Get active discount coupons
CREATE OR REPLACE FUNCTION public.get_active_coupons(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
  id UUID,
  code TEXT,
  discount_percent INTEGER,
  applies_to TEXT[],
  expires_at TIMESTAMPTZ,
  hours_remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id,
    dc.code,
    dc.discount_percent,
    dc.applies_to,
    dc.expires_at,
    GREATEST(0, EXTRACT(EPOCH FROM dc.expires_at - NOW()) / 3600)::INTEGER as hours_remaining
  FROM discount_coupons dc
  WHERE dc.user_id = p_user_id
    AND dc.expires_at > NOW()
    AND dc.used_at IS NULL
  ORDER BY dc.expires_at ASC;
END;
$$;
