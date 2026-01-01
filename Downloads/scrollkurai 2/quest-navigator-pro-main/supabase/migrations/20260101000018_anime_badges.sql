-- Anime-Style Badge System

-- 1. Badges Table (Definitions)
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL, -- Emoji or image URL
  description TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary', 'ultra_rare')),
  category TEXT NOT NULL CHECK (category IN ('speed', 'streak', 'surprise', 'mastery', 'limited')),
  is_limited BOOLEAN DEFAULT FALSE,
  total_supply INTEGER, -- NULL = unlimited
  current_holders INTEGER DEFAULT 0,
  criteria JSONB, -- {"type": "streak", "value": 7} or {"type": "speed", "seconds": 600, "days": 3}
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. User Badges Table
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  badge_id UUID NOT NULL REFERENCES public.badges(id),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE, -- Grayed out if streak breaks
  metadata JSONB, -- {"completion_time_seconds": 372, "trigger": "quest_complete"}
  UNIQUE(user_id, badge_id)
);

-- 3. Badge Events (Surprise Trigger Config)
CREATE TABLE IF NOT EXISTS public.badge_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  badge_id UUID REFERENCES public.badges(id),
  event_type TEXT NOT NULL, -- 'quest_complete', 'login', 'midnight_quest', etc.
  probability DECIMAL(5,4), -- 0.0100 = 1%
  reward_payload JSONB, -- {"power_ups": 1} or {"xp_boost_hours": 12}
  active BOOLEAN DEFAULT TRUE,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
);

-- 4. Seed Initial Badges
INSERT INTO public.badges (name, icon, description, rarity, category, is_limited, total_supply, criteria) VALUES
-- Speed Badges
('Flash Mind', '⚡', 'Complete daily quest within 10 mins for 3 days', 'rare', 'speed', FALSE, NULL, 
  '{"type": "speed_streak", "max_seconds": 600, "days": 3}'::JSONB),
('Instant Awakening', '🌀', 'Complete quest within 5 mins (once)', 'legendary', 'speed', FALSE, NULL,
  '{"type": "speed_single", "max_seconds": 300}'::JSONB),
('Time Bender', '⏱️', 'Complete quests under 10 mins for 7 days', 'epic', 'speed', FALSE, NULL,
  '{"type": "speed_streak", "max_seconds": 600, "days": 7}'::JSONB),

-- Streak Badges
('Lone Warrior', '🐺', '7-day streak achieved', 'rare', 'streak', FALSE, NULL,
  '{"type": "streak", "value": 7}'::JSONB),
('Dragon Will', '🐉', '30-day streak achieved', 'epic', 'streak', TRUE, NULL,
  '{"type": "streak", "value": 30}'::JSONB),
('Immortal Resolve', '👑', '100-day streak achieved', 'ultra_rare', 'streak', TRUE, 100,
  '{"type": "streak", "value": 100}'::JSONB),

-- Surprise Badges
('RNG Blessed', '🎲', 'Touched by fate itself', 'rare', 'surprise', FALSE, NULL,
  '{"type": "random", "event": "login"}'::JSONB),
('Midnight Hero', '🌙', 'Quest completed after 11 PM IST', 'rare', 'surprise', FALSE, NULL,
  '{"type": "time_based", "hour_after": 23}'::JSONB),
('Fate Chosen', '🎁', 'One in a hundred completions', 'legendary', 'surprise', FALSE, NULL,
  '{"type": "random", "event": "quest_complete", "probability": 0.01}'::JSONB),

-- Mastery Badges
('Knowledge Ascended', '📚', 'Same quest type completed 10 times', 'epic', 'mastery', FALSE, NULL,
  '{"type": "quest_type_count", "count": 10}'::JSONB),
('Relentless Loop', '🔁', '14 days without skipping', 'epic', 'mastery', FALSE, NULL,
  '{"type": "no_skip_streak", "days": 14}'::JSONB),
('System Breaker', '🧩', 'Used power-ups strategically 5 times', 'rare', 'mastery', FALSE, NULL,
  '{"type": "powerup_usage", "count": 5}'::JSONB),

-- Limited Badges
('Founding Warrior', '⚔️', 'Among the first 5,000 users', 'ultra_rare', 'limited', TRUE, 5000,
  '{"type": "early_adopter", "max_users": 5000}'::JSONB),
('New Year Ascension 2026', '🎆', 'Started journey on Jan 1-7, 2026', 'legendary', 'limited', TRUE, NULL,
  '{"type": "date_range", "start": "2026-01-01", "end": "2026-01-07"}'::JSONB)
ON CONFLICT (name) DO NOTHING;

-- 5. RLS Policies
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badge_events ENABLE ROW LEVEL SECURITY;

-- Anyone can view badge definitions
CREATE POLICY "public_read_badges" ON public.badges FOR SELECT TO authenticated USING (true);

-- Users can view their own badges
CREATE POLICY "users_read_own_badges" ON public.user_badges 
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Service role can manage
CREATE POLICY "service_manage_user_badges" ON public.user_badges
  FOR ALL TO service_role USING (true);

CREATE POLICY "service_manage_badge_events" ON public.badge_events
  FOR ALL TO service_role USING (true);

-- 6. RPC: Award Badge (Idempotent)
CREATE OR REPLACE FUNCTION public.award_badge(
  p_user_id UUID,
  p_badge_name TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  badge_record RECORD;
  existing_badge UUID;
  result JSONB;
BEGIN
  -- Get badge
  SELECT * INTO badge_record FROM badges WHERE name = p_badge_name AND active = TRUE;
  
  IF badge_record IS NULL THEN
    RETURN jsonb_build_object('awarded', FALSE, 'reason', 'Badge not found or inactive');
  END IF;
  
  -- Check if limited and sold out
  IF badge_record.is_limited AND badge_record.total_supply IS NOT NULL THEN
    IF badge_record.current_holders >= badge_record.total_supply THEN
      RETURN jsonb_build_object('awarded', FALSE, 'reason', 'Badge supply exhausted');
    END IF;
  END IF;
  
  -- Check if already awarded
  SELECT id INTO existing_badge FROM user_badges 
  WHERE user_id = p_user_id AND badge_id = badge_record.id;
  
  IF existing_badge IS NOT NULL THEN
    RETURN jsonb_build_object('awarded', FALSE, 'reason', 'Already earned');
  END IF;
  
  -- Award the badge
  INSERT INTO user_badges (user_id, badge_id, metadata)
  VALUES (p_user_id, badge_record.id, p_metadata);
  
  -- Increment holders count
  UPDATE badges SET current_holders = current_holders + 1 WHERE id = badge_record.id;
  
  -- Log is recorded in user_badges.metadata, no separate audit needed
  
  RETURN jsonb_build_object(
    'awarded', TRUE,
    'badge', jsonb_build_object(
      'name', badge_record.name,
      'icon', badge_record.icon,
      'rarity', badge_record.rarity,
      'description', badge_record.description
    ),
    'total_holders', badge_record.current_holders + 1
  );
END;
$$;

-- 7. RPC: Get User Badges
CREATE OR REPLACE FUNCTION public.get_user_badges(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
  badge_id UUID,
  name TEXT,
  icon TEXT,
  description TEXT,
  rarity TEXT,
  category TEXT,
  is_limited BOOLEAN,
  total_holders INTEGER,
  earned_at TIMESTAMPTZ,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id as badge_id,
    b.name,
    b.icon,
    b.description,
    b.rarity,
    b.category,
    b.is_limited,
    b.current_holders as total_holders,
    ub.earned_at,
    ub.is_active
  FROM user_badges ub
  JOIN badges b ON b.id = ub.badge_id
  WHERE ub.user_id = p_user_id
  ORDER BY ub.earned_at DESC;
END;
$$;

-- 8. RPC: Check and Award Speed Badge
CREATE OR REPLACE FUNCTION public.check_speed_badge(
  p_user_id UUID,
  p_completion_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB := '[]'::JSONB;
  badge_result JSONB;
  fast_quest_count INTEGER;
BEGIN
  -- Instant Awakening: Under 5 mins once
  IF p_completion_seconds <= 300 THEN
    SELECT award_badge(p_user_id, 'Instant Awakening', 
      jsonb_build_object('completion_seconds', p_completion_seconds)) INTO badge_result;
    IF badge_result->>'awarded' = 'true' THEN
      result := result || badge_result;
    END IF;
  END IF;
  
  -- Count fast quests (under 10 mins) in last N days
  SELECT COUNT(*) INTO fast_quest_count
  FROM user_quest_log
  WHERE user_id = p_user_id
    AND completed_at IS NOT NULL
    AND EXTRACT(EPOCH FROM (completed_at - created_at)) <= 600
    AND completed_at > NOW() - INTERVAL '7 days';
  
  -- Flash Mind: 3 fast days
  IF fast_quest_count >= 3 THEN
    SELECT award_badge(p_user_id, 'Flash Mind',
      jsonb_build_object('fast_quests', fast_quest_count)) INTO badge_result;
    IF badge_result->>'awarded' = 'true' THEN
      result := result || badge_result;
    END IF;
  END IF;
  
  -- Time Bender: 7 fast days
  IF fast_quest_count >= 7 THEN
    SELECT award_badge(p_user_id, 'Time Bender',
      jsonb_build_object('fast_quests', fast_quest_count)) INTO badge_result;
    IF badge_result->>'awarded' = 'true' THEN
      result := result || badge_result;
    END IF;
  END IF;
  
  RETURN result;
END;
$$;

-- 9. RPC: Check Streak Badges
CREATE OR REPLACE FUNCTION public.check_streak_badges(
  p_user_id UUID,
  p_streak INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB := '[]'::JSONB;
  badge_result JSONB;
BEGIN
  -- Lone Warrior: 7-day streak
  IF p_streak >= 7 THEN
    SELECT award_badge(p_user_id, 'Lone Warrior',
      jsonb_build_object('streak', p_streak)) INTO badge_result;
    IF badge_result->>'awarded' = 'true' THEN
      result := result || badge_result;
    END IF;
  END IF;
  
  -- Dragon Will: 30-day streak
  IF p_streak >= 30 THEN
    SELECT award_badge(p_user_id, 'Dragon Will',
      jsonb_build_object('streak', p_streak)) INTO badge_result;
    IF badge_result->>'awarded' = 'true' THEN
      result := result || badge_result;
    END IF;
  END IF;
  
  -- Immortal Resolve: 100-day streak
  IF p_streak >= 100 THEN
    SELECT award_badge(p_user_id, 'Immortal Resolve',
      jsonb_build_object('streak', p_streak)) INTO badge_result;
    IF badge_result->>'awarded' = 'true' THEN
      result := result || badge_result;
    END IF;
  END IF;
  
  RETURN result;
END;
$$;

-- 10. RPC: Check Surprise Badge (Probability-based)
CREATE OR REPLACE FUNCTION public.check_surprise_badge(
  p_user_id UUID,
  p_trigger TEXT -- 'quest_complete', 'login', etc.
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB := '[]'::JSONB;
  badge_result JSONB;
  random_roll DECIMAL;
  current_hour INTEGER;
BEGIN
  random_roll := random();
  current_hour := EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Kolkata');
  
  -- Midnight Hero: Quest after 11 PM IST
  IF p_trigger = 'quest_complete' AND current_hour >= 23 THEN
    SELECT award_badge(p_user_id, 'Midnight Hero',
      jsonb_build_object('hour', current_hour)) INTO badge_result;
    IF badge_result->>'awarded' = 'true' THEN
      result := result || badge_result;
    END IF;
  END IF;
  
  -- Fate Chosen: 1% chance on quest complete
  IF p_trigger = 'quest_complete' AND random_roll < 0.01 THEN
    SELECT award_badge(p_user_id, 'Fate Chosen',
      jsonb_build_object('roll', random_roll)) INTO badge_result;
    IF badge_result->>'awarded' = 'true' THEN
      result := result || badge_result;
    END IF;
  END IF;
  
  -- RNG Blessed: 0.5% chance on login
  IF p_trigger = 'login' AND random_roll < 0.005 THEN
    SELECT award_badge(p_user_id, 'RNG Blessed',
      jsonb_build_object('roll', random_roll)) INTO badge_result;
    IF badge_result->>'awarded' = 'true' THEN
      result := result || badge_result;
    END IF;
  END IF;
  
  RETURN result;
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.award_badge TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_badges TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_speed_badge TO service_role;
GRANT EXECUTE ON FUNCTION public.check_streak_badges TO service_role;
GRANT EXECUTE ON FUNCTION public.check_surprise_badge TO service_role;
