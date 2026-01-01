-- Ensure Admin Streak Override Works Reliably

-- 1. Create streak_override_audit table if not exists
CREATE TABLE IF NOT EXISTS public.streak_override_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL,
  user_id UUID NOT NULL,
  previous_streak INTEGER NOT NULL,
  restored_streak INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. RLS for streak_override_audit
ALTER TABLE public.streak_override_audit ENABLE ROW LEVEL SECURITY;

-- Allow admins to read audit logs
DROP POLICY IF EXISTS "admin_read_streak_audit" ON public.streak_override_audit;
CREATE POLICY "admin_read_streak_audit" ON public.streak_override_audit
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Allow service_role to insert
DROP POLICY IF EXISTS "service_insert_streak_audit" ON public.streak_override_audit;
CREATE POLICY "service_insert_streak_audit" ON public.streak_override_audit
  FOR INSERT TO service_role
  WITH CHECK (true);

-- 3. Also allow authenticated users with admin role to insert (backup)
DROP POLICY IF EXISTS "admin_insert_streak_audit" ON public.streak_override_audit;
CREATE POLICY "admin_insert_streak_audit" ON public.streak_override_audit
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
