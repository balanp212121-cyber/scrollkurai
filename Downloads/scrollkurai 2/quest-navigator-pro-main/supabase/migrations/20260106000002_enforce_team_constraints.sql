/* 
  Enforce Team Type Constraints
  Prevent malicious clients from setting wrong max_members for Duos
*/

CREATE OR REPLACE FUNCTION public.enforce_team_constraints()
RETURNS TRIGGER AS $$
BEGIN
  -- Force Duo constraints
  IF NEW.team_type = 'duo' THEN
    NEW.max_members := 2;
  END IF;

  -- Force Team constraints (optional, but good for safety)
  IF NEW.team_type = 'team' THEN
    -- Cap at 5, Min 3 (or strictly what user asked, but capped)
    IF NEW.max_members > 5 THEN
      NEW.max_members := 5;
    END IF;
    IF NEW.max_members < 2 THEN
       NEW.max_members := 3; -- Minimum sensible size for a "Team"
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_team_constraints ON public.teams;
CREATE TRIGGER trg_enforce_team_constraints
  BEFORE INSERT OR UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_team_constraints();
