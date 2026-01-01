-- Fix Team Creation Issues

-- 1. Add unique constraint to prevent duplicate team memberships
ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_unique_user_team;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_unique_user_team UNIQUE (team_id, user_id);

-- 2. Create trigger to auto-add creator as team admin
CREATE OR REPLACE FUNCTION public.add_team_creator_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (NEW.id, NEW.creator_id, 'admin')
  ON CONFLICT (team_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_add_team_creator ON public.teams;
CREATE TRIGGER trg_add_team_creator
  AFTER INSERT ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.add_team_creator_as_admin();
