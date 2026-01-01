-- Create league enum
CREATE TYPE public.league_tier AS ENUM ('bronze', 'silver', 'gold', 'platinum', 'diamond');

-- Create leagues table
CREATE TABLE public.leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier league_tier NOT NULL UNIQUE,
  name TEXT NOT NULL,
  min_rank INTEGER NOT NULL,
  xp_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_leagues table to track current league membership
CREATE TABLE public.user_leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  league_tier league_tier NOT NULL DEFAULT 'bronze',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Create league_weeks table to track weekly periods
CREATE TABLE public.league_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start TIMESTAMP WITH TIME ZONE NOT NULL,
  week_end TIMESTAMP WITH TIME ZONE NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(week_start)
);

-- Create league_participations table for weekly rankings
CREATE TABLE public.league_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  league_tier league_tier NOT NULL,
  week_id UUID NOT NULL REFERENCES league_weeks(id) ON DELETE CASCADE,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  promoted BOOLEAN DEFAULT false,
  demoted BOOLEAN DEFAULT false,
  badge_awarded UUID REFERENCES badges(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, week_id)
);

-- Insert default league tiers
INSERT INTO public.leagues (tier, name, min_rank, xp_multiplier) VALUES
  ('bronze', 'Bronze League', 1, 1.0),
  ('silver', 'Silver League', 1, 1.1),
  ('gold', 'Gold League', 1, 1.2),
  ('platinum', 'Platinum League', 1, 1.3),
  ('diamond', 'Diamond League', 1, 1.5);

-- Insert league badges
INSERT INTO public.badges (name, description, icon, requirement_type, requirement_value) VALUES
  ('Bronze Champion', 'Top 10 in Bronze League', '🥉', 'league_rank', 10),
  ('Silver Champion', 'Top 10 in Silver League', '🥈', 'league_rank', 10),
  ('Gold Champion', 'Top 10 in Gold League', '🥇', 'league_rank', 10),
  ('Platinum Champion', 'Top 10 in Platinum League', '💎', 'league_rank', 10),
  ('Diamond Champion', 'Top 10 in Diamond League', '👑', 'league_rank', 10);

-- Enable RLS
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_participations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leagues (read-only for all authenticated users)
CREATE POLICY "Anyone can view leagues"
  ON public.leagues FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for user_leagues
CREATE POLICY "Users can view all league memberships"
  ON public.user_leagues FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own league membership"
  ON public.user_leagues FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can update league memberships"
  ON public.user_leagues FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for league_weeks
CREATE POLICY "Anyone can view league weeks"
  ON public.league_weeks FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for league_participations
CREATE POLICY "Users can view all participations"
  ON public.league_participations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own participation"
  ON public.league_participations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can update participations"
  ON public.league_participations FOR UPDATE
  TO authenticated
  USING (true);

-- Create trigger to update user_leagues updated_at
CREATE TRIGGER update_user_leagues_updated_at
  BEFORE UPDATE ON public.user_leagues
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create function to get current league week
CREATE OR REPLACE FUNCTION public.get_current_league_week()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_week_id UUID;
  week_start TIMESTAMP WITH TIME ZONE;
  week_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get Monday of current week
  week_start := date_trunc('week', now());
  week_end := week_start + interval '7 days';
  
  -- Get or create current week
  SELECT id INTO current_week_id
  FROM league_weeks
  WHERE league_weeks.week_start = week_start;
  
  IF current_week_id IS NULL THEN
    INSERT INTO league_weeks (week_start, week_end)
    VALUES (week_start, week_end)
    RETURNING id INTO current_week_id;
  END IF;
  
  RETURN current_week_id;
END;
$$;

-- Create function to get league leaderboard
CREATE OR REPLACE FUNCTION public.get_league_leaderboard(
  league_tier_param league_tier,
  week_id_param UUID DEFAULT NULL
)
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  xp_earned INTEGER,
  rank INTEGER,
  league_tier league_tier
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_week_id UUID;
BEGIN
  -- Use provided week or get current week
  target_week_id := COALESCE(week_id_param, get_current_league_week());
  
  RETURN QUERY
  SELECT 
    lp.user_id,
    p.username,
    lp.xp_earned,
    lp.rank,
    lp.league_tier
  FROM league_participations lp
  JOIN profiles p ON p.id = lp.user_id
  WHERE lp.league_tier = league_tier_param
    AND lp.week_id = target_week_id
  ORDER BY lp.xp_earned DESC, lp.created_at ASC;
END;
$$;