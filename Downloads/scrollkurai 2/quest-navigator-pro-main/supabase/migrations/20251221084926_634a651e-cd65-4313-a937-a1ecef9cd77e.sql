-- Drop and recreate search_users_by_username function with improved search
CREATE OR REPLACE FUNCTION public.search_users_by_username(search_term text)
RETURNS TABLE(id uuid, username text, level integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Search for usernames containing the search term (case insensitive)
  -- Also search from the beginning for exact matches to appear first
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.level
  FROM public.profiles p
  WHERE p.username IS NOT NULL 
    AND p.username <> ''
    AND p.username ILIKE '%' || search_term || '%'
  ORDER BY 
    -- Prioritize exact matches and matches at the start
    CASE WHEN p.username ILIKE search_term THEN 0
         WHEN p.username ILIKE search_term || '%' THEN 1
         ELSE 2
    END,
    p.username ASC
  LIMIT 10;
END;
$$;