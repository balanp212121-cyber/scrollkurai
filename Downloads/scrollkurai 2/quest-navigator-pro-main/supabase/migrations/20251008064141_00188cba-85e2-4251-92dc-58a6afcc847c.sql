-- Add quiz tracking and brain rot score to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS quiz_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS brain_rot_score INTEGER DEFAULT 0;

-- Create badges table
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  requirement_type TEXT NOT NULL, -- 'streak', 'xp', 'quests', 'level'
  requirement_value INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_badges table
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- Enable RLS on badges
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user_badges
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for badges (everyone can view)
CREATE POLICY "Anyone can view badges"
ON public.badges FOR SELECT
TO authenticated
USING (true);

-- RLS Policies for user_badges
CREATE POLICY "Users can view their own badges"
ON public.user_badges FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own badges"
ON public.user_badges FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Insert initial badges
INSERT INTO public.badges (name, description, icon, requirement_type, requirement_value) VALUES
('First Step', 'Complete your first quest', '🎯', 'quests', 1),
('Week Warrior', 'Maintain a 7-day streak', '🔥', 'streak', 7),
('XP Hunter', 'Earn 100 XP', '⭐', 'xp', 100),
('Level Up', 'Reach level 5', '🚀', 'level', 5),
('Consistency King', 'Maintain a 30-day streak', '👑', 'streak', 30),
('XP Master', 'Earn 500 XP', '💎', 'xp', 500),
('Quest Champion', 'Complete 50 quests', '🏆', 'quests', 50),
('Legendary', 'Reach level 10', '⚡', 'level', 10);