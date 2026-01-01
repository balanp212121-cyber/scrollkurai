
-- Fix ambiguous column reference in get_current_league_week function
CREATE OR REPLACE FUNCTION public.get_current_league_week()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_week_start TIMESTAMP WITH TIME ZONE;
  current_week_end TIMESTAMP WITH TIME ZONE;
  found_week_id UUID;
BEGIN
  -- Calculate current week boundaries (Monday to Sunday)
  current_week_start := date_trunc('week', now());
  current_week_end := current_week_start + interval '7 days';
  
  -- Check if this week exists
  SELECT lw.id INTO found_week_id
  FROM league_weeks lw
  WHERE lw.week_start = current_week_start;
  
  -- If not found, create it
  IF found_week_id IS NULL THEN
    INSERT INTO league_weeks (week_start, week_end)
    VALUES (current_week_start, current_week_end)
    RETURNING id INTO found_week_id;
  END IF;
  
  RETURN found_week_id;
END;
$$;
