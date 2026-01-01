-- Create teams table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  creator_id UUID NOT NULL,
  max_members INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create team_members table
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create team_challenges table
CREATE TABLE public.team_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 7,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create team_challenge_progress table
CREATE TABLE public.team_challenge_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.team_challenges(id) ON DELETE CASCADE,
  current_progress INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create power_ups table
CREATE TABLE public.power_ups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  price INTEGER NOT NULL,
  effect_type TEXT NOT NULL,
  effect_value INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_power_ups table
CREATE TABLE public.user_power_ups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  power_up_id UUID NOT NULL REFERENCES public.power_ups(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  used_at TIMESTAMP WITH TIME ZONE
);

-- Create premium_lessons table
CREATE TABLE public.premium_lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  video_url TEXT,
  duration_minutes INTEGER NOT NULL,
  category TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lesson_progress table
CREATE TABLE public.lesson_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lesson_id UUID NOT NULL REFERENCES public.premium_lessons(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on all tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.power_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_power_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

-- RLS policies for teams
CREATE POLICY "Users can view teams they are members of"
  ON public.teams FOR SELECT
  USING (id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can create teams"
  ON public.teams FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Team creators can update their teams"
  ON public.teams FOR UPDATE
  USING (auth.uid() = creator_id);

-- RLS policies for team_members
CREATE POLICY "Users can view team members of their teams"
  ON public.team_members FOR SELECT
  USING (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));

CREATE POLICY "Team creators can add members"
  ON public.team_members FOR INSERT
  WITH CHECK (team_id IN (SELECT id FROM public.teams WHERE creator_id = auth.uid()));

CREATE POLICY "Users can leave teams"
  ON public.team_members FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for team_challenges
CREATE POLICY "Anyone can view team challenges"
  ON public.team_challenges FOR SELECT
  USING (true);

-- RLS policies for team_challenge_progress
CREATE POLICY "Users can view their team's progress"
  ON public.team_challenge_progress FOR SELECT
  USING (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));

CREATE POLICY "Team members can update progress"
  ON public.team_challenge_progress FOR UPDATE
  USING (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));

CREATE POLICY "Teams can join challenges"
  ON public.team_challenge_progress FOR INSERT
  WITH CHECK (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));

-- RLS policies for subscriptions
CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subscription"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS policies for power_ups
CREATE POLICY "Anyone can view power-ups"
  ON public.power_ups FOR SELECT
  USING (true);

-- RLS policies for user_power_ups
CREATE POLICY "Users can view their own power-ups"
  ON public.user_power_ups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can purchase power-ups"
  ON public.user_power_ups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can use their power-ups"
  ON public.user_power_ups FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for premium_lessons
CREATE POLICY "Premium users can view lessons"
  ON public.premium_lessons FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.subscriptions 
    WHERE user_id = auth.uid() 
    AND tier = 'premium' 
    AND status = 'active'
  ));

-- RLS policies for lesson_progress
CREATE POLICY "Users can view their own lesson progress"
  ON public.lesson_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their lesson progress"
  ON public.lesson_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their lesson progress"
  ON public.lesson_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- Insert initial power-ups
INSERT INTO public.power_ups (name, description, icon, price, effect_type, effect_value) VALUES
  ('Streak Shield', 'Save your streak once if you miss a day', '🛡️', 29, 'streak_save', 1),
  ('XP Booster', 'Double XP for 24 hours', '⚡', 19, 'xp_multiplier', 2),
  ('Custom Avatar Pack', 'Unlock exclusive avatar customizations', '🎨', 49, 'cosmetic', 1);

-- Insert sample team challenges
INSERT INTO public.team_challenges (title, description, target_type, target_value, duration_days, ends_at) VALUES
  ('Team Time Savers', 'Collectively reduce screen time by 10 hours this week', 'time_saved', 600, 7, now() + interval '7 days'),
  ('Quest Masters', 'Complete 50 quests together as a team', 'quests_completed', 50, 7, now() + interval '7 days'),
  ('XP Champions', 'Earn 5000 XP combined this week', 'xp_earned', 5000, 7, now() + interval '7 days');