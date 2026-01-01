-- Duo Creation Feature (Team Extension)

-- 1. Add team_type column to teams table
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS team_type TEXT CHECK (team_type IN ('team', 'duo')) DEFAULT 'team';

-- 2. Create trigger to enforce max_members based on team_type
CREATE OR REPLACE FUNCTION public.enforce_team_member_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_member_count INTEGER;
  team_max_members INTEGER;
  team_type_val TEXT;
BEGIN
  -- Get team info
  SELECT max_members, team_type INTO team_max_members, team_type_val
  FROM public.teams
  WHERE id = NEW.team_id;

  -- For duos, enforce max 2
  IF team_type_val = 'duo' THEN
    team_max_members := 2;
  END IF;

  -- Count current members
  SELECT COUNT(*) INTO current_member_count
  FROM public.team_members
  WHERE team_id = NEW.team_id;

  -- Block if at capacity
  IF current_member_count >= team_max_members THEN
    RAISE EXCEPTION 'Team or Duo has reached maximum member capacity (%)' , team_max_members;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_team_limit ON public.team_members;
CREATE TRIGGER trg_enforce_team_limit
  BEFORE INSERT ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_team_member_limit();

-- 3. Constraint: User can only be in one active Duo
CREATE OR REPLACE FUNCTION public.enforce_one_duo_per_user()
RETURNS TRIGGER AS $$
DECLARE
  team_type_val TEXT;
  existing_duo_count INTEGER;
BEGIN
  -- Check if the team being joined is a duo
  SELECT team_type INTO team_type_val
  FROM public.teams
  WHERE id = NEW.team_id;

  IF team_type_val = 'duo' THEN
    -- Check if user is already in a duo
    SELECT COUNT(*) INTO existing_duo_count
    FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE tm.user_id = NEW.user_id AND t.team_type = 'duo';

    IF existing_duo_count > 0 THEN
      RAISE EXCEPTION 'User is already in a Duo. Leave current Duo first.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_one_duo ON public.team_members;
CREATE TRIGGER trg_enforce_one_duo
  BEFORE INSERT ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_one_duo_per_user();

-- 4. RPC to create a Duo (with validation)
CREATE OR REPLACE FUNCTION public.create_duo(
  p_name TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_duo_id UUID;
  existing_duo_count INTEGER;
  current_user_id UUID;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check if user is already in a duo
  SELECT COUNT(*) INTO existing_duo_count
  FROM public.team_members tm
  JOIN public.teams t ON t.id = tm.team_id
  WHERE tm.user_id = current_user_id AND t.team_type = 'duo';

  IF existing_duo_count > 0 THEN
    RAISE EXCEPTION 'User is already in a Duo. Leave current Duo first.';
  END IF;

  -- Create duo
  INSERT INTO public.teams (name, description, creator_id, team_type, max_members)
  VALUES (p_name, p_description, current_user_id, 'duo', 2)
  RETURNING id INTO new_duo_id;

  -- Creator is added as admin by existing trigger (trg_add_team_creator)

  RETURN new_duo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC to invite partner to Duo
CREATE OR REPLACE FUNCTION public.invite_to_duo(
  p_duo_id UUID,
  p_partner_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  team_type_val TEXT;
  current_member_count INTEGER;
  is_admin BOOLEAN;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify it's a duo
  SELECT team_type INTO team_type_val
  FROM public.teams
  WHERE id = p_duo_id;

  IF team_type_val != 'duo' THEN
    RAISE EXCEPTION 'This function is only for Duos';
  END IF;

  -- Verify caller is admin
  SELECT (role = 'admin') INTO is_admin
  FROM public.team_members
  WHERE team_id = p_duo_id AND user_id = current_user_id;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only Duo admin can invite partners';
  END IF;

  -- Check current member count
  SELECT COUNT(*) INTO current_member_count
  FROM public.team_members
  WHERE team_id = p_duo_id;

  IF current_member_count >= 2 THEN
    RAISE EXCEPTION 'Duo is already full';
  END IF;

  -- Add partner as member
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (p_duo_id, p_partner_user_id, 'member')
  ON CONFLICT (team_id, user_id) DO NOTHING;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
