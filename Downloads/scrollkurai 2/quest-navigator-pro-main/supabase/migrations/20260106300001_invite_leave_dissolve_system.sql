/*
  Team & Duo Invite Link System + Leave/Dissolve Functionality
  Complete Social Infrastructure Migration
*/

-- ==========================================
-- PART 1: INVITE LINKS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.team_invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('team', 'duo')),
  entity_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  is_revoked BOOLEAN DEFAULT false,
  max_uses INTEGER DEFAULT 1,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_invite_links_token ON public.team_invite_links(token);
CREATE INDEX IF NOT EXISTS idx_invite_links_entity ON public.team_invite_links(entity_id);

-- Enable RLS
ALTER TABLE public.team_invite_links ENABLE ROW LEVEL SECURITY;

-- Only entity creator can create invite links
CREATE POLICY "Only creator can create invite links"
  ON public.team_invite_links FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND entity_id IN (SELECT id FROM public.teams WHERE creator_id = auth.uid())
  );

-- Only creator can view their invite links
CREATE POLICY "Creator can view own invite links"
  ON public.team_invite_links FOR SELECT
  USING (
    entity_id IN (SELECT id FROM public.teams WHERE creator_id = auth.uid())
  );

-- Only creator can revoke (update) links
CREATE POLICY "Creator can revoke invite links"
  ON public.team_invite_links FOR UPDATE
  USING (
    entity_id IN (SELECT id FROM public.teams WHERE creator_id = auth.uid())
  );

-- ==========================================
-- PART 2: DISSOLVED STATUS FOR TEAMS
-- ==========================================

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS dissolved BOOLEAN DEFAULT false;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS dissolved_at TIMESTAMP WITH TIME ZONE;

-- Prevent viewing dissolved teams (update existing RLS)
DROP POLICY IF EXISTS "Users can view teams they are members of" ON public.teams;
CREATE POLICY "Users can view active teams they are members of"
  ON public.teams FOR SELECT
  USING (
    dissolved = false
    AND id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
  );

-- ==========================================
-- PART 3: GENERATE INVITE LINK FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION public.generate_invite_link(
  p_entity_id UUID,
  p_expires_in_days INTEGER DEFAULT 7
)
RETURNS TABLE (token TEXT, expires_at TIMESTAMP WITH TIME ZONE) AS $$
DECLARE
  team_record RECORD;
  new_token TEXT;
  expiry TIMESTAMP WITH TIME ZONE;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get team info
  SELECT t.id, t.creator_id, t.team_type, t.dissolved
  INTO team_record
  FROM public.teams t
  WHERE t.id = p_entity_id;

  IF team_record IS NULL THEN
    RAISE EXCEPTION 'Team not found';
  END IF;

  IF team_record.dissolved = true THEN
    RAISE EXCEPTION 'Cannot generate invite for dissolved team';
  END IF;

  -- Only creator can generate invite
  IF team_record.creator_id != current_user_id THEN
    RAISE EXCEPTION 'Only team creator can generate invite links';
  END IF;

  -- Generate secure token
  new_token := encode(gen_random_bytes(16), 'hex');
  expiry := now() + (p_expires_in_days || ' days')::interval;

  -- Revoke existing active links (optional: one active link at a time)
  UPDATE public.team_invite_links
  SET is_revoked = true
  WHERE entity_id = p_entity_id AND is_revoked = false;

  -- Insert new link
  INSERT INTO public.team_invite_links (entity_type, entity_id, token, created_by, expires_at, max_uses)
  VALUES (team_record.team_type, p_entity_id, new_token, current_user_id, expiry, 
          CASE WHEN team_record.team_type = 'duo' THEN 1 ELSE 5 END);

  RETURN QUERY SELECT new_token, expiry;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- PART 4: JOIN VIA INVITE FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION public.join_via_invite(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  invite_record RECORD;
  team_record RECORD;
  current_user_id UUID;
  creator_id UUID;
  member_count INTEGER;
  existing_membership INTEGER;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get invite link
  SELECT * INTO invite_record
  FROM public.team_invite_links
  WHERE token = p_token;

  IF invite_record IS NULL THEN
    RAISE EXCEPTION 'Invalid invite link';
  END IF;

  IF invite_record.is_revoked THEN
    RAISE EXCEPTION 'This invite link has been revoked';
  END IF;

  IF invite_record.expires_at < now() THEN
    RAISE EXCEPTION 'This invite link has expired';
  END IF;

  IF invite_record.use_count >= invite_record.max_uses THEN
    RAISE EXCEPTION 'This invite link has reached its usage limit';
  END IF;

  -- Get team info
  SELECT * INTO team_record
  FROM public.teams
  WHERE id = invite_record.entity_id;

  IF team_record IS NULL OR team_record.dissolved THEN
    RAISE EXCEPTION 'Team no longer exists or has been dissolved';
  END IF;

  creator_id := team_record.creator_id;

  -- Verify user is friend of creator
  IF NOT public.are_friends(creator_id, current_user_id) AND current_user_id != creator_id THEN
    RAISE EXCEPTION 'You must be friends with the team creator to join';
  END IF;

  -- Check if user already in same type of team/duo
  IF team_record.team_type = 'team' THEN
    SELECT COUNT(*) INTO existing_membership
    FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE tm.user_id = current_user_id AND t.team_type = 'team' AND t.dissolved = false;

    IF existing_membership > 0 THEN
      RAISE EXCEPTION 'You are already in a Team. Leave your current Team first.';
    END IF;
  ELSE -- duo
    SELECT COUNT(*) INTO existing_membership
    FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE tm.user_id = current_user_id AND t.team_type = 'duo' AND t.dissolved = false;

    IF existing_membership > 0 THEN
      RAISE EXCEPTION 'You are already in a Duo. Leave your current Duo first.';
    END IF;
  END IF;

  -- Check capacity
  SELECT COUNT(*) INTO member_count
  FROM public.team_members
  WHERE team_id = invite_record.entity_id;

  IF member_count >= team_record.max_members THEN
    -- Revoke invite since team is full
    UPDATE public.team_invite_links SET is_revoked = true WHERE id = invite_record.id;
    RAISE EXCEPTION 'This team is already at full capacity';
  END IF;

  -- Add member
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (invite_record.entity_id, current_user_id, 'member')
  ON CONFLICT (team_id, user_id) DO NOTHING;

  -- Increment use count
  UPDATE public.team_invite_links
  SET use_count = use_count + 1
  WHERE id = invite_record.id;

  -- Revoke if max uses reached or duo is now full
  IF invite_record.use_count + 1 >= invite_record.max_uses OR 
     (team_record.team_type = 'duo' AND member_count + 1 >= 2) THEN
    UPDATE public.team_invite_links SET is_revoked = true WHERE id = invite_record.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'team_name', team_record.name,
    'team_type', team_record.team_type
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- PART 5: LEAVE TEAM FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION public.leave_team(p_team_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  team_record RECORD;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get team info
  SELECT creator_id, team_type INTO team_record
  FROM public.teams WHERE id = p_team_id;

  IF team_record IS NULL THEN
    RAISE EXCEPTION 'Team not found';
  END IF;

  -- Block creator from leaving
  IF current_user_id = team_record.creator_id THEN
    RAISE EXCEPTION 'Team creator cannot leave. Dissolve the team instead.';
  END IF;

  -- For duos, leaving = dissolving
  IF team_record.team_type = 'duo' THEN
    PERFORM public.dissolve_team(p_team_id);
    RETURN TRUE;
  END IF;

  -- Remove member
  DELETE FROM public.team_members
  WHERE team_id = p_team_id AND user_id = current_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- PART 6: DISSOLVE TEAM FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION public.dissolve_team(p_team_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  team_record RECORD;
  current_user_id UUID;
  is_member BOOLEAN;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get team info
  SELECT creator_id, team_type, dissolved INTO team_record
  FROM public.teams WHERE id = p_team_id;

  IF team_record IS NULL THEN
    RAISE EXCEPTION 'Team not found';
  END IF;

  IF team_record.dissolved THEN
    RAISE EXCEPTION 'Team is already dissolved';
  END IF;

  -- Check if user is a member
  SELECT EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE team_id = p_team_id AND user_id = current_user_id
  ) INTO is_member;

  -- For teams, only creator can dissolve
  -- For duos, any member can dissolve
  IF team_record.team_type = 'team' AND current_user_id != team_record.creator_id THEN
    RAISE EXCEPTION 'Only team creator can dissolve the team.';
  END IF;

  IF team_record.team_type = 'duo' AND NOT is_member THEN
    RAISE EXCEPTION 'Only duo members can dissolve the duo.';
  END IF;

  -- Remove all members
  DELETE FROM public.team_members WHERE team_id = p_team_id;

  -- Remove from active challenges
  DELETE FROM public.team_challenge_progress WHERE team_id = p_team_id;

  -- Revoke all invite links
  UPDATE public.team_invite_links 
  SET is_revoked = true 
  WHERE entity_id = p_team_id;

  -- Mark as dissolved
  UPDATE public.teams 
  SET dissolved = true, dissolved_at = now()
  WHERE id = p_team_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- PART 7: PREVENT JOINING DISSOLVED TEAMS
-- ==========================================

CREATE OR REPLACE FUNCTION public.block_dissolved_team_joins()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.teams WHERE id = NEW.team_id AND dissolved = true) THEN
    RAISE EXCEPTION 'Cannot join a dissolved team';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_dissolved_joins ON public.team_members;
CREATE TRIGGER trg_block_dissolved_joins
  BEFORE INSERT ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.block_dissolved_team_joins();

-- ==========================================
-- PART 8: UNIQUE CONSTRAINT FOR TEAM_MEMBERS
-- ==========================================

-- Ensure unique membership 
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'team_members_team_user_unique'
  ) THEN
    ALTER TABLE public.team_members 
    ADD CONSTRAINT team_members_team_user_unique UNIQUE (team_id, user_id);
  END IF;
END $$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.generate_invite_link(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_via_invite(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_team(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dissolve_team(UUID) TO authenticated;

-- Reload schema cache
NOTIFY pgrst, 'reload config';
