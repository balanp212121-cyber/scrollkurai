-- =====================================================
-- SCROLLKURAI SCALE OPTIMIZATION MIGRATION
-- Fixes for 1M user capacity
-- =====================================================

-- 1. COMPOSITE INDEX ON user_quest_log
-- Critical for daily quest lookups at scale
CREATE INDEX IF NOT EXISTS idx_user_quest_log_user_date 
ON public.user_quest_log(user_id, assignment_date DESC);

-- 2. INDEX ON ai_daily_usage for rate limiting
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date
ON public.ai_daily_usage(user_id, usage_date);

-- 3. INDEX ON profiles for common lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username
ON public.profiles(username) WHERE username IS NOT NULL;

-- 4. INDEX ON payment_proofs for admin queries
CREATE INDEX IF NOT EXISTS idx_payment_proofs_status
ON public.payment_proofs(status, created_at DESC);

-- 5. INDEX ON counselling_requests for admin queries  
CREATE INDEX IF NOT EXISTS idx_counselling_requests_status
ON public.counselling_requests(status, created_at DESC);

-- 6. INDEX ON course_requests for admin queries
CREATE INDEX IF NOT EXISTS idx_course_requests_status
ON public.course_requests(status, created_at DESC);

-- 7. INDEX ON badges for user lookups
CREATE INDEX IF NOT EXISTS idx_user_badges_user
ON public.user_badges(user_id, awarded_at DESC);

-- 8. INDEX ON admin_audit_logs for filtering
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action
ON public.admin_audit_logs(action, created_at DESC);

-- 9. INDEX ON teams for member lookups
CREATE INDEX IF NOT EXISTS idx_team_members_user
ON public.team_members(user_id);

-- 10. ANALYZE tables to update statistics
ANALYZE public.user_quest_log;
ANALYZE public.profiles;
ANALYZE public.ai_daily_usage;

-- =====================================================
-- NOTE: Run this migration in Supabase SQL Editor
-- 
-- After running, enable connection pooling:
-- 1. Supabase Dashboard → Settings → Database
-- 2. Enable "Connection Pooling" 
-- 3. Set mode to "Transaction"
-- 4. Use the pooler connection string in production
-- =====================================================
