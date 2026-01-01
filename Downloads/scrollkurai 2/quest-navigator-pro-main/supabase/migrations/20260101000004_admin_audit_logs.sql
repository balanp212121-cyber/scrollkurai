-- ============================================
-- ADMIN AUDIT LOGS (LIGHTWEIGHT)
-- ============================================
-- Purpose: Track high-impact admin actions for accountability
-- Design: Append-only, minimal overhead, fire-and-forget
-- 
-- LOGGED ACTIONS (High-Impact Only):
-- - role_change: Admin adds/removes user roles
-- - streak_restore: Admin restores user streak
-- - payment_approve: Admin approves payment proof
-- - payment_reject: Admin rejects payment proof
-- - counselling_confirm: Admin confirms counselling session
-- - counselling_decline: Admin declines counselling request
--
-- NOT LOGGED (Low-Impact):
-- - Page views, reads, analytics, searches
-- ============================================

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who performed the action
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- What action was performed
  action TEXT NOT NULL,
  
  -- What was affected (user, payment, etc.)
  target_type TEXT NOT NULL,
  target_id UUID,
  
  -- Additional context (optional, keep small)
  metadata JSONB DEFAULT '{}',
  
  -- When it happened
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Append-only: No updates or deletes allowed
-- This is enforced by RLS policies below

-- Index for time-based queries (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created 
  ON admin_audit_logs(created_at DESC);

-- Index for filtering by action type
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action 
  ON admin_audit_logs(action);

-- Index for finding actions by admin
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin 
  ON admin_audit_logs(admin_user_id);

-- ============================================
-- RLS POLICIES
-- Security: Only admins can READ, no one can UPDATE/DELETE
-- ============================================

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs
CREATE POLICY "Admins can view audit logs"
ON public.admin_audit_logs FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Service role can insert (for Edge Functions)
-- No direct user inserts - must go through functions
CREATE POLICY "Service role can insert audit logs"
ON public.admin_audit_logs FOR INSERT
WITH CHECK (true); -- Controlled by Edge Functions with service role

-- CRITICAL: No UPDATE policy = no updates allowed
-- CRITICAL: No DELETE policy = no deletes allowed

-- ============================================
-- HELPER FUNCTION (Fire-and-Forget Pattern)
-- ============================================
-- Use this in Edge Functions to log admin actions
-- Failures are logged but do NOT block the main action

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_admin_user_id UUID,
  p_action TEXT,
  p_target_type TEXT,
  p_target_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO admin_audit_logs (
    admin_user_id, action, target_type, target_id, metadata
  ) VALUES (
    p_admin_user_id, p_action, p_target_type, p_target_id, p_metadata
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Log failure but don't block the calling action
    RAISE WARNING 'Failed to log admin action: %', SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role only
GRANT EXECUTE ON FUNCTION public.log_admin_action(UUID, TEXT, TEXT, UUID, JSONB) TO service_role;

-- ============================================
-- ROLE DELEGATION MODEL (DOCUMENTED)
-- ============================================
-- SUPER_ADMIN (Founder Only):
--   ✓ Full access to everything
--   ✓ Role assignment (add/remove admin, moderator)
--   ✓ Audit log access
--   ✓ Streak overrides
--   ✓ AI endpoint control
--   ✓ System configuration
--
-- MODERATOR (First Delegation):
--   ✓ Review and approve/reject payment proofs
--   ✓ Approve/decline counselling requests
--   ✓ Read-only user data access
--   ✗ NO role changes (cannot escalate privileges)
--   ✗ NO streak restores (data integrity)
--   ✗ NO AI access (cost control)
--   ✗ NO billing/subscription changes
--
-- DELEGATION GUIDELINES:
--   Delegate when: Admin work > 30 min/day OR approvals delayed > 24h
--   Never delegate: Role changes, payments, AI access, data deletion
-- ============================================

COMMENT ON TABLE admin_audit_logs IS 'Append-only audit log for high-impact admin actions. No updates or deletes allowed.';
