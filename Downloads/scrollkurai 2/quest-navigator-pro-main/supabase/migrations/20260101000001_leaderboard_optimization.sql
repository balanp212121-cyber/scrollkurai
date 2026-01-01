-- ============================================
-- PHASE 1: Leaderboard Optimization
-- Creates materialized view for 100k scale
-- ============================================

-- Materialized view for fast leaderboard queries
-- Refreshes every 5 minutes via cron (configured separately)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.leaderboard_cache AS
SELECT 
  p.id as user_id,
  p.username,
  p.xp,
  p.level,
  p.streak,
  COALESCE(lp.league_tier::text, 'bronze') as league_tier,
  COALESCE(lp.xp_earned, 0) as weekly_xp,
  ROW_NUMBER() OVER (
    PARTITION BY COALESCE(lp.league_tier::text, 'bronze') 
    ORDER BY COALESCE(lp.xp_earned, 0) DESC
  ) as rank
FROM profiles p
LEFT JOIN league_participations lp ON p.id = lp.user_id 
  AND lp.week_id = (
    SELECT id FROM league_weeks 
    WHERE week_end > NOW() 
    ORDER BY week_start DESC 
    LIMIT 1
  )
WITH DATA;

-- Indexes for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_cache_user 
  ON leaderboard_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_tier_rank 
  ON leaderboard_cache(league_tier, rank);
CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_xp 
  ON leaderboard_cache(xp DESC);

-- Function to refresh the cache (called by cron or manual trigger)
CREATE OR REPLACE FUNCTION public.refresh_leaderboard_cache()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_cache;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.refresh_leaderboard_cache() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_leaderboard_cache() TO service_role;

-- RPC function to get cached leaderboard (replacement for heavy query)
CREATE OR REPLACE FUNCTION public.get_cached_leaderboard(
  tier_param TEXT DEFAULT 'bronze',
  limit_param INT DEFAULT 50,
  offset_param INT DEFAULT 0
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  xp INT,
  level INT,
  streak INT,
  league_tier TEXT,
  weekly_xp INT,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lc.user_id,
    lc.username,
    lc.xp::INT,
    lc.level::INT,
    lc.streak::INT,
    lc.league_tier,
    lc.weekly_xp::INT,
    lc.rank
  FROM leaderboard_cache lc
  WHERE lc.league_tier = tier_param
  ORDER BY lc.rank ASC
  LIMIT limit_param
  OFFSET offset_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant access
GRANT EXECUTE ON FUNCTION public.get_cached_leaderboard(TEXT, INT, INT) TO authenticated;

-- Schedule refresh every 5 minutes (requires pg_cron extension)
-- NOTE: This may already exist or need to be done via Supabase Dashboard
-- SELECT cron.schedule('refresh-leaderboard', '*/5 * * * *', 'SELECT refresh_leaderboard_cache()');

COMMENT ON MATERIALIZED VIEW leaderboard_cache IS 
  'Cached leaderboard for 100k scale. Refresh every 5 minutes.';
