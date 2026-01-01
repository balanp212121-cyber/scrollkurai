-- ============================================
-- PHASE 3: 1-1 Counselling System
-- Simple, trust-based booking flow
-- ============================================

-- Counselling requests table
CREATE TABLE IF NOT EXISTS public.counselling_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  
  -- Request details (user fills this)
  concern_summary TEXT NOT NULL,
  preferred_times TEXT, -- Free text: "Weekday evenings, Saturday afternoon"
  additional_notes TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Admin response
  admin_notes TEXT,
  meeting_link TEXT,
  session_scheduled_for TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_by UUID REFERENCES auth.users,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- User feedback (post-session)
  user_feedback TEXT,
  rating INT CHECK (rating >= 1 AND rating <= 5)
);

-- Status check constraint
ALTER TABLE public.counselling_requests
  ADD CONSTRAINT chk_counselling_status 
  CHECK (status IN ('pending', 'confirmed', 'declined', 'completed', 'cancelled', 'no_show'));

-- Enable RLS
ALTER TABLE public.counselling_requests ENABLE ROW LEVEL SECURITY;

-- Users can view and create their own requests
CREATE POLICY "Users can view own requests"
ON public.counselling_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own requests"
ON public.counselling_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending requests (cancel, add feedback)
CREATE POLICY "Users can update own requests"
ON public.counselling_requests FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins can do everything
CREATE POLICY "Admins can manage all requests"
ON public.counselling_requests FOR ALL
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_counselling_requests_user 
  ON counselling_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_counselling_requests_status 
  ON counselling_requests(status);
CREATE INDEX IF NOT EXISTS idx_counselling_requests_created 
  ON counselling_requests(created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_counselling_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS counselling_request_updated_at ON counselling_requests;
CREATE TRIGGER counselling_request_updated_at
  BEFORE UPDATE ON counselling_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_counselling_request_timestamp();

-- Function to get pending request count (for admin dashboard badge)
CREATE OR REPLACE FUNCTION public.get_pending_counselling_count()
RETURNS INT AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INT 
    FROM counselling_requests 
    WHERE status = 'pending'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_pending_counselling_count() TO authenticated;

-- Check if user has active request (to prevent spam)
CREATE OR REPLACE FUNCTION public.has_active_counselling_request()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM counselling_requests 
    WHERE user_id = auth.uid() 
    AND status IN ('pending', 'confirmed')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.has_active_counselling_request() TO authenticated;

COMMENT ON TABLE counselling_requests IS '1-1 counselling session requests. Admin-managed flow.';
