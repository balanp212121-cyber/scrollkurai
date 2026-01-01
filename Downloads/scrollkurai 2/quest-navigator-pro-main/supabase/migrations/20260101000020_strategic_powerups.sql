-- Remaining Phases: Strategic Power-Ups, Quest Personalization, Earned Invitations

-- 1. Strategic Power-Ups Table
CREATE TABLE IF NOT EXISTS public.strategic_powerups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  description TEXT NOT NULL,
  effect JSONB NOT NULL, -- {"xp_multiplier": 3, "risk": "lose_tomorrow_quest"}
  cost_type TEXT NOT NULL CHECK (cost_type IN ('free', 'premium', 'earned')),
  cooldown_days INTEGER DEFAULT 7,
  active BOOLEAN DEFAULT TRUE
);

-- Seed Strategic Power-Ups
INSERT INTO public.strategic_powerups (id, name, icon, description, effect, cost_type, cooldown_days) VALUES
('blood_oath', 'Blood Oath', '⚔️', '3× XP today. Lose tomorrow''s quest if you fail.', 
  '{"xp_multiplier": 3, "risk": "lose_tomorrow_quest", "risk_description": "If you fail today, tomorrow''s quest is forfeit"}'::JSONB, 'earned', 7),
('shadow_clone', 'Shadow Clone', '👥', 'Complete 2 quests today. Both must succeed.', 
  '{"extra_quests": 2, "risk": "both_must_complete", "risk_description": "If either fails, both fail"}'::JSONB, 'premium', 14),
('time_dilation', 'Time Dilation', '⏳', 'Extend quest deadline by 4 hours. -50% XP.', 
  '{"deadline_hours": 4, "xp_penalty": 0.5, "risk_description": "Reduced XP for extra time"}'::JSONB, 'free', 3),
('phoenix_flame', 'Phoenix Flame', '🔥', 'Recover yesterday''s broken streak. Must complete 2 quests today.', 
  '{"recover_streak": true, "required_quests": 2, "risk_description": "Requires 2 quests to activate"}'::JSONB, 'premium', 30)
ON CONFLICT (id) DO NOTHING;

-- 2. User Strategic Power-Up Usage
CREATE TABLE IF NOT EXISTS public.user_strategic_powerups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  powerup_id TEXT NOT NULL REFERENCES public.strategic_powerups(id),
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  outcome TEXT CHECK (outcome IN ('pending', 'success', 'failed')),
  outcome_at TIMESTAMPTZ,
  UNIQUE(user_id, powerup_id, activated_at::DATE)
);

-- 3. Quest Meaning Text Table
CREATE TABLE IF NOT EXISTS public.quest_meanings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quest_type TEXT NOT NULL, -- 'focus', 'habit', 'reflection', etc.
  identity_class TEXT REFERENCES public.identity_classes(id),
  meaning_text TEXT NOT NULL,
  weight INTEGER DEFAULT 1 -- For random selection
);

-- Seed Quest Meanings
INSERT INTO public.quest_meanings (quest_type, identity_class, meaning_text) VALUES
-- General meanings
('focus', NULL, 'This quest sharpens your resistance to distraction.'),
('focus', NULL, 'Today you practice the art of single-pointed attention.'),
('habit', NULL, 'Small actions compound into extraordinary results.'),
('habit', NULL, 'You are reinforcing who you want to become.'),
('reflection', NULL, 'Understanding yourself is the first step to mastery.'),
('meditation', NULL, 'Stillness is where clarity emerges.'),
-- Identity-specific meanings
('focus', 'mind_warrior', 'A warrior''s mind cuts through chaos like a blade.'),
('focus', 'focus_assassin', 'The assassin strikes only when fully locked on.'),
('habit', 'discipline_monk', 'The monk''s power grows with each repeated practice.'),
('reflection', 'calm_strategist', 'The strategist sees patterns others miss.')
ON CONFLICT DO NOTHING;

-- 4. Earned Invitations Table
CREATE TABLE IF NOT EXISTS public.earned_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id),
  invite_code TEXT UNIQUE NOT NULL DEFAULT SUBSTRING(gen_random_uuid()::TEXT, 1, 8),
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  earned_reason TEXT NOT NULL, -- 'streak_7', 'streak_30', 'level_10', etc.
  used_by_user_id UUID REFERENCES auth.users(id),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

-- 5. RPC: Activate Strategic Power-Up
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
  
  -- Check cooldown
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

-- 6. RPC: Get Quest Meaning
CREATE OR REPLACE FUNCTION public.get_quest_meaning(
  p_quest_type TEXT,
  p_identity_class TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  meaning TEXT;
BEGIN
  -- Try identity-specific first
  IF p_identity_class IS NOT NULL THEN
    SELECT meaning_text INTO meaning
    FROM quest_meanings
    WHERE quest_type = p_quest_type AND identity_class = p_identity_class
    ORDER BY RANDOM() LIMIT 1;
    
    IF meaning IS NOT NULL THEN
      RETURN meaning;
    END IF;
  END IF;
  
  -- Fall back to generic
  SELECT meaning_text INTO meaning
  FROM quest_meanings
  WHERE quest_type = p_quest_type AND identity_class IS NULL
  ORDER BY RANDOM() LIMIT 1;
  
  RETURN COALESCE(meaning, 'Every quest brings you closer to who you want to become.');
END;
$$;

-- 7. RPC: Earn Invitation (on milestones)
CREATE OR REPLACE FUNCTION public.earn_invitation(
  p_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_code TEXT;
BEGIN
  -- Check if already earned for this reason
  IF EXISTS (SELECT 1 FROM earned_invitations WHERE owner_user_id = p_user_id AND earned_reason = p_reason) THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'Already earned for this milestone');
  END IF;
  
  new_code := UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8));
  
  INSERT INTO earned_invitations (owner_user_id, invite_code, earned_reason)
  VALUES (p_user_id, new_code, p_reason);
  
  -- Create ritual moment
  INSERT INTO ritual_moments (user_id, moment_type, title, description, data)
  VALUES (
    p_user_id,
    'invitation_earned',
    'You Earned an Invitation',
    'Invite one person to witness your discipline.',
    jsonb_build_object('code', new_code, 'reason', p_reason)
  );
  
  RETURN jsonb_build_object('success', TRUE, 'invite_code', new_code);
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
ALTER TABLE public.quest_meanings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earned_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_powerups" ON public.strategic_powerups FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_read_own_powerup_usage" ON public.user_strategic_powerups FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "public_read_meanings" ON public.quest_meanings FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_read_own_invitations" ON public.earned_invitations FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "service_manage_invitations" ON public.earned_invitations FOR ALL TO service_role USING (true);

-- 10. Grants
GRANT EXECUTE ON FUNCTION public.activate_strategic_powerup TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quest_meaning TO authenticated;
GRANT EXECUTE ON FUNCTION public.earn_invitation TO service_role;
GRANT EXECUTE ON FUNCTION public.get_active_strategic_powerups TO authenticated;
