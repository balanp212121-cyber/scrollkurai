-- Fix search_path for check_team_max_members function
CREATE OR REPLACE FUNCTION check_team_max_members()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Get current member count and max allowed
  SELECT COUNT(*), t.max_members
  INTO current_count, max_allowed
  FROM team_members tm
  JOIN teams t ON t.id = tm.team_id
  WHERE tm.team_id = NEW.team_id
  GROUP BY t.max_members;

  -- If team doesn't exist yet, get max from teams table
  IF current_count IS NULL THEN
    SELECT max_members INTO max_allowed
    FROM teams WHERE id = NEW.team_id;
    current_count := 0;
  END IF;

  -- Enforce max members (3-5 range)
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Team has reached maximum members (% of %)', current_count, max_allowed;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
