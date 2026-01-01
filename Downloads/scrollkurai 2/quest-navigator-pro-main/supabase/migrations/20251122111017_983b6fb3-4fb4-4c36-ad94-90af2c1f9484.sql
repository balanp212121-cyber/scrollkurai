-- Priority 1: Onboarding Progress Table
CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  step_completed TEXT NOT NULL DEFAULT 'welcome',
  completed_at TIMESTAMP WITH TIME ZONE,
  skipped BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for onboarding_progress
CREATE POLICY "Users can view their own onboarding progress"
  ON public.onboarding_progress
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own onboarding progress"
  ON public.onboarding_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own onboarding progress"
  ON public.onboarding_progress
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_onboarding_progress_updated_at
  BEFORE UPDATE ON public.onboarding_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Priority 2: Analytics Tables
CREATE TABLE IF NOT EXISTS public.user_analytics_daily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  xp_earned INTEGER DEFAULT 0,
  quests_completed INTEGER DEFAULT 0,
  time_saved_minutes INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.user_analytics_daily ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_analytics_daily
CREATE POLICY "Users can view their own analytics"
  ON public.user_analytics_daily
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert analytics"
  ON public.user_analytics_daily
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update analytics"
  ON public.user_analytics_daily
  FOR UPDATE
  USING (true);

-- Create user_milestones table
CREATE TABLE IF NOT EXISTS public.user_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  milestone_type TEXT NOT NULL,
  milestone_value INTEGER NOT NULL,
  achieved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_milestones ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_milestones
CREATE POLICY "Users can view their own milestones"
  ON public.user_milestones
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert milestones"
  ON public.user_milestones
  FOR INSERT
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_analytics_daily_user_date 
  ON public.user_analytics_daily(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_user_milestones_user 
  ON public.user_milestones(user_id, achieved_at DESC);