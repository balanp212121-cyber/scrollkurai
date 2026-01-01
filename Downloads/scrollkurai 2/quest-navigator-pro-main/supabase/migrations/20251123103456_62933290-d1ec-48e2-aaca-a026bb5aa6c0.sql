-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule weekly league processing job (runs every Monday at 00:01 UTC)
SELECT cron.schedule(
  'process-weekly-leagues',
  '1 0 * * 1', -- Every Monday at 00:01
  $$
  SELECT net.http_post(
    url:='https://eldzmgtlgphjgwprtwfa.supabase.co/functions/v1/process-league-week',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsZHptZ3RsZ3Boamd3cHJ0d2ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzkxNDYsImV4cCI6MjA3NTA1NTE0Nn0.gXa1ENFu5MTNdDGu9iRIrrXz2TmWsvfZ8NN3853GaCM"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Log successful setup
COMMENT ON EXTENSION pg_cron IS 'Enabled for weekly league processing and scheduled jobs';
