/* 
  Enforce One Team Per User + Creator-Only Challenge Joins + Friend Search Index
  Phase 1: Database Constraints for Strict Social Rules
*/

-- ==========================================
-- RULE 2A: One Team Per User (Parallel to One Duo)
-- ==========================================

CREATE OR REPLACE FUNCTION public.enforce_one_team_per_user()
RETURNS TRIGGER AS $$
DECLARE
  team_type_val TEXT;
  existing_team_count INTEGER;
BEGIN
  -- Check if the team being joined is a team (not duo)
  SELECT team_type INTO team_type_val
  FROM public.teams
  WHERE id = NEW.team_id;

  IF team_type_val = 'team' THEN
    -- Check if user is already in a team
    SELECT COUNT(*) INTO existing_team_count
    FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE tm.user_id = NEW.user_id AND t.team_type = 'team';

    IF existing_team_count > 0 THEN
      RAISE EXCEPTION 'You are already in a Team. Leave your current Team first.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_one_team ON public.team_members;
CREATE TRIGGER trg_enforce_one_team
  BEFORE INSERT ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_one_team_per_user();

-- ==========================================
-- RULE 3: Creator-Only Challenge Joins (RLS)
-- ==========================================

-- Drop old permissive policy if exists
DROP POLICY IF EXISTS "Teams can join challenges" ON public.team_challenge_progress;

-- New: Only creators can INSERT (join challenges)
CREATE POLICY "Only team creators can join challenges"
  ON public.team_challenge_progress FOR INSERT
  WITH CHECK (
    team_id IN (SELECT id FROM public.teams WHERE creator_id = auth.uid())
  );

-- ==========================================
-- RULE 4: Friend Search Index (Prefix Matching)
-- ==========================================

-- Index for fast prefix search on usernames
CREATE INDEX IF NOT EXISTS idx_profiles_username_prefix 
  ON public.profiles (LOWER(username) text_pattern_ops);

-- Also index on display_name if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'display_name'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_profiles_display_name_prefix 
      ON public.profiles (LOWER(display_name) text_pattern_ops);
  END IF;
END $$;

-- ==========================================
-- RULE 2: Friends-Only Validation Function
-- ==========================================

-- Function to check if two users are friends
CREATE OR REPLACE FUNCTION public.are_friends(user1_id UUID, user2_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.friends
    WHERE (user_id = user1_id AND friend_id = user2_id AND status = 'accepted')
       OR (user_id = user2_id AND friend_id = user1_id AND status = 'accepted')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enforcement: Only allow adding friends to teams
CREATE OR REPLACE FUNCTION public.enforce_friends_only_team_members()
RETURNS TRIGGER AS $$
DECLARE
  team_creator_id UUID;
BEGIN
  -- Get team creator
  SELECT creator_id INTO team_creator_id
  FROM public.teams
  WHERE id = NEW.team_id;

  -- If the user being added is the creator, allow (they're adding themselves)
  IF NEW.user_id = team_creator_id THEN
    RETURN NEW;
  END IF;

  -- If the user being added is friends with the creator, allow
  IF public.are_friends(team_creator_id, NEW.user_id) THEN
    RETURN NEW;
  END IF;

  -- Block non-friends
  RAISE EXCEPTION 'You can only add friends to your Team or Duo';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_friends_only ON public.team_members;
CREATE TRIGGER trg_enforce_friends_only
  BEFORE INSERT ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_friends_only_team_members();

-- Reload schema cache
NOTIFY pgrst, 'reload config';
