-- Create course_requests table for personalized course curation
CREATE TABLE IF NOT EXISTS public.course_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_status TEXT NOT NULL CHECK (user_status IN ('school', 'college', 'unemployed', 'employed')),
  topics TEXT[] NOT NULL,
  additional_info TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed')),
  admin_response TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.course_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own course requests" ON public.course_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own requests
CREATE POLICY "Users can create course requests" ON public.course_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all requests
CREATE POLICY "Admins can view all course requests" ON public.course_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Admins can update requests (for responding)
CREATE POLICY "Admins can update course requests" ON public.course_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_course_requests_user_id ON public.course_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_course_requests_status ON public.course_requests(status);
CREATE INDEX IF NOT EXISTS idx_course_requests_created_at ON public.course_requests(created_at DESC);

-- Grant permissions
GRANT SELECT, INSERT ON public.course_requests TO authenticated;
GRANT ALL ON public.course_requests TO service_role;

COMMENT ON TABLE public.course_requests IS 'Stores user requests for personalized video course recommendations';
