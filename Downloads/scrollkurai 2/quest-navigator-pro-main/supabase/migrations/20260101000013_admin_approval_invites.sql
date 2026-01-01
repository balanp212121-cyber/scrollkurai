-- Admin Approval & Creator-Only Invites for Team/Duo Challenges

-- PART 1: Add approval_status and approved_by to challenges
ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS approval_status TEXT 
CHECK (approval_status IN ('pending', 'approved', 'rejected'))
DEFAULT 'pending';

ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Auto-approve existing solo challenges
UPDATE public.challenges
SET approval_status = 'approved'
WHERE challenge_type = 'solo' AND approval_status = 'pending';

-- PART 2: Add invited_by to team_members (for tracking who invited)
ALTER TABLE public.team_members
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id);

-- PART 3: Trigger to auto-approve solo challenges
CREATE OR REPLACE FUNCTION public.auto_approve_solo_challenge()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.challenge_type = 'solo' THEN
    NEW.approval_status := 'approved';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_approve_solo ON public.challenges;
CREATE TRIGGER trg_auto_approve_solo
  BEFORE INSERT ON public.challenges
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_approve_solo_challenge();

-- PART 4: RPC for admin to approve/reject challenges
CREATE OR REPLACE FUNCTION public.admin_approve_challenge(
  p_challenge_id UUID,
  p_action TEXT -- 'approve' or 'reject'
)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID;
  is_admin BOOLEAN;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check admin role
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = current_user_id AND role = 'admin'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_action = 'approve' THEN
    UPDATE public.challenges
    SET 
      approval_status = 'approved',
      approved_by = current_user_id,
      approved_at = NOW()
    WHERE id = p_challenge_id;
  ELSIF p_action = 'reject' THEN
    UPDATE public.challenges
    SET 
      approval_status = 'rejected',
      approved_by = current_user_id,
      approved_at = NOW()
    WHERE id = p_challenge_id;
  ELSE
    RAISE EXCEPTION 'Invalid action. Use approve or reject.';
  END IF;

  -- Log admin action
  INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (
    current_user_id,
    'challenge_' || p_action,
    'challenge',
    p_challenge_id,
    jsonb_build_object('action', p_action)
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PART 5: RPC for creator-only team invite
CREATE OR REPLACE FUNCTION public.invite_team_member(
  p_team_id UUID,
  p_invitee_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID;
  team_creator_id UUID;
  team_type_val TEXT;
  current_member_count INTEGER;
  max_allowed INTEGER;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get team info
  SELECT creator_id, team_type, max_members 
  INTO team_creator_id, team_type_val, max_allowed
  FROM public.teams
  WHERE id = p_team_id;

  IF team_creator_id IS NULL THEN
    RAISE EXCEPTION 'Team not found';
  END IF;

  -- CRITICAL: Only creator can invite
  IF current_user_id != team_creator_id THEN
    RAISE EXCEPTION 'Only team creator can invite members';
  END IF;

  -- Check member count
  SELECT COUNT(*) INTO current_member_count
  FROM public.team_members
  WHERE team_id = p_team_id;

  IF current_member_count >= max_allowed THEN
    RAISE EXCEPTION 'Team is full (% members maximum)', max_allowed;
  END IF;

  -- Create invite record
  INSERT INTO public.team_invites (
    team_id,
    inviter_id,
    invitee_id,
    status
  ) VALUES (
    p_team_id,
    current_user_id,
    p_invitee_id,
    'pending'
  )
  ON CONFLICT (team_id, invitee_id) 
  DO UPDATE SET status = 'pending', created_at = NOW();

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PART 6: RPC to get pending challenges for admin
CREATE OR REPLACE FUNCTION public.get_pending_challenges()
RETURNS TABLE(
  id UUID,
  title TEXT,
  description TEXT,
  challenge_type TEXT,
  creator_id UUID,
  creator_username TEXT,
  created_at TIMESTAMPTZ,
  approval_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  is_admin BOOLEAN;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check admin role
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = current_user_id AND role = 'admin'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT 
    c.id,
    c.title,
    c.description,
    c.challenge_type,
    c.creator_id,
    p.username as creator_username,
    c.created_at,
    c.approval_status
  FROM challenges c
  JOIN profiles p ON p.id = c.creator_id
  WHERE c.approval_status = 'pending'
    AND c.challenge_type IN ('team', 'duo')
  ORDER BY c.created_at ASC;
END;
$$;
