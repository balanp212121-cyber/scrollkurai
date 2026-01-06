/* 
  Friends-Only Search Function
  RULE 1: Only show friends when selecting team/duo members
  RULE 4: First-character prefix matching
*/

-- Create a function that searches only among accepted friends
CREATE OR REPLACE FUNCTION public.search_friends_by_username(search_term TEXT)
RETURNS TABLE (
  id UUID,
  username TEXT,
  level INTEGER
) AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Return friends whose username starts with the search term (prefix match)
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.level
  FROM public.profiles p
  WHERE 
    -- User must be an accepted friend
    (
      EXISTS (
        SELECT 1 FROM public.friends f
        WHERE f.status = 'accepted'
        AND (
          (f.user_id = current_user_id AND f.friend_id = p.id)
          OR (f.friend_id = current_user_id AND f.user_id = p.id)
        )
      )
    )
    -- Prefix match (starts with)
    AND LOWER(p.username) LIKE LOWER(search_term) || '%'
    -- Exclude self
    AND p.id != current_user_id
  ORDER BY p.username
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.search_friends_by_username(TEXT) TO authenticated;

-- Reload schema cache
NOTIFY pgrst, 'reload config';
