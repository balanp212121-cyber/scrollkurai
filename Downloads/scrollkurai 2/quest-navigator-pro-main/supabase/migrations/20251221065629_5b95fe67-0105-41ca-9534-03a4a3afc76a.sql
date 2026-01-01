-- Add streak recovery tracking columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS streak_lost_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_streak_count INTEGER;

-- Create table for streak override audit logs
CREATE TABLE IF NOT EXISTS public.streak_override_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL,
  user_id UUID NOT NULL,
  previous_streak INTEGER NOT NULL DEFAULT 0,
  restored_streak INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT 'manual override',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on the audit table
ALTER TABLE public.streak_override_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can view streak override audit logs
CREATE POLICY "Admins can view streak override audit logs"
ON public.streak_override_audit
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Only through edge functions (service role) can insert audit logs
CREATE POLICY "Service role can insert streak override audit logs"
ON public.streak_override_audit
FOR INSERT
WITH CHECK (true);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_streak_lost_at ON public.profiles(streak_lost_at);
CREATE INDEX IF NOT EXISTS idx_streak_override_audit_user_id ON public.streak_override_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_streak_override_audit_admin_id ON public.streak_override_audit(admin_id);