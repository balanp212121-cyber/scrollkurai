-- Run this in Supabase SQL Editor to ensure the search function exists

-- Check if function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name = 'search_users_by_username';

-- Test the function
SELECT * FROM search_users_by_username('balan');

-- If empty, check what users exist
SELECT id, username, level FROM profiles WHERE username IS NOT NULL LIMIT 10;
