-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username TEXT,
  archetype TEXT NOT NULL DEFAULT 'Certified Brain Rotter',
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  streak INTEGER NOT NULL DEFAULT 0,
  last_quest_date DATE,
  total_quests_completed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create quests table
CREATE TABLE public.quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  reflection_prompt TEXT NOT NULL,
  target_archetype TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on quests
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;

-- Quests policies (readable by authenticated users)
CREATE POLICY "Authenticated users can view quests"
  ON public.quests FOR SELECT
  TO authenticated
  USING (true);

-- Create user_quest_log table
CREATE TABLE public.user_quest_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  quest_id UUID NOT NULL REFERENCES public.quests ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  reflection_text TEXT,
  xp_awarded INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_quest_log
ALTER TABLE public.user_quest_log ENABLE ROW LEVEL SECURITY;

-- user_quest_log policies
CREATE POLICY "Users can view their own quest logs"
  ON public.user_quest_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quest logs"
  ON public.user_quest_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quest logs"
  ON public.user_quest_log FOR UPDATE
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_user_quest_log_user_id ON public.user_quest_log(user_id);
CREATE INDEX idx_user_quest_log_quest_id ON public.user_quest_log(quest_id);
CREATE INDEX idx_user_quest_log_assigned_at ON public.user_quest_log(assigned_at DESC);
CREATE INDEX idx_profiles_xp ON public.profiles(xp DESC);
CREATE INDEX idx_profiles_streak ON public.profiles(streak DESC);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add trigger to profiles
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, archetype)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    'Certified Brain Rotter'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Insert seed quests
INSERT INTO public.quests (content, reflection_prompt, target_archetype) VALUES
  ('Read 5 pages of a book (any book)', 'What was the main idea or takeaway?', 'Certified Brain Rotter'),
  ('Take a 10-minute walk outside without your phone', 'How did you feel during the walk?', 'Certified Brain Rotter'),
  ('Write down 3 things you''re grateful for', 'Why are these things meaningful to you?', 'Certified Brain Rotter'),
  ('Complete a 15-minute focused work session (Pomodoro)', 'What did you work on and what did you accomplish?', 'Recovering Scroller'),
  ('Watch an educational video instead of scrolling', 'What new thing did you learn?', 'Recovering Scroller'),
  ('Practice a new skill for 20 minutes', 'What progress did you make today?', 'Mindful Warrior'),
  ('Meditate or do breathing exercises for 5 minutes', 'How did this practice affect your mental state?', 'Mindful Warrior'),
  ('Create something (art, writing, music, code)', 'What inspired you to create this?', 'Peak Performer'),
  ('Teach someone something you know', 'What did you teach and how did they respond?', 'Peak Performer'),
  ('Plan tomorrow''s top 3 priorities', 'Why are these your top priorities?', 'Peak Performer');