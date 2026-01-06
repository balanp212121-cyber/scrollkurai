-- Reload PostgREST Schema Cache
-- This is necessary after creating new tables/triggers if Edge Functions fail to see them immediately.

NOTIFY pgrst, 'reload config';
