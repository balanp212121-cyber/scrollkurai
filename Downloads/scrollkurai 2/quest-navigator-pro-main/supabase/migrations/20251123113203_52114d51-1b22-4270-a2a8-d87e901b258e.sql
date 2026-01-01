-- Fix infinite recursion in team_members RLS policies
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Team members can send invites" ON team_invites;
DROP POLICY IF EXISTS "Users can view teams they are members of" ON teams;
DROP POLICY IF EXISTS "Invitees can respond to invites" ON team_invites;
DROP POLICY IF EXISTS "Users can view relevant invites" ON team_invites;

-- Create security definer function to check team membership (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
  );
$$;

-- Recreate policies using the security definer function
CREATE POLICY "Users can view teams they are members of"
ON teams
FOR SELECT
TO authenticated
USING (public.is_team_member(auth.uid(), id));

CREATE POLICY "Team members can send invites"
ON team_invites
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = inviter_id
  AND public.is_team_member(auth.uid(), team_id)
);

CREATE POLICY "Invitees can respond to invites"
ON team_invites
FOR UPDATE
TO authenticated
USING (auth.uid() = invitee_id);

CREATE POLICY "Users can view relevant invites"
ON team_invites
FOR SELECT
TO authenticated
USING (
  auth.uid() = invitee_id
  OR public.is_team_member(auth.uid(), team_id)
);