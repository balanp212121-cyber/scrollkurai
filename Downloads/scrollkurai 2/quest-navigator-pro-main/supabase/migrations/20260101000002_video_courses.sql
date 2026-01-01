-- ============================================
-- PHASE 2: Video Courses Enhancement
-- Adds video management fields and security
-- ============================================

-- Enhance premium_lessons table with video management fields
ALTER TABLE public.premium_lessons 
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS video_provider TEXT DEFAULT 'external',
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add video_provider check constraint
DO $$ BEGIN
  ALTER TABLE public.premium_lessons 
    ADD CONSTRAINT chk_video_provider 
    CHECK (video_provider IN ('external', 'supabase', 'youtube', 'bunny'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.premium_lessons ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to recreate cleanly)
DROP POLICY IF EXISTS "Premium users can view published lessons" ON public.premium_lessons;
DROP POLICY IF EXISTS "Admins can manage lessons" ON public.premium_lessons;

-- Users can only view published lessons if they have premium status
CREATE POLICY "Premium users can view published lessons"
ON public.premium_lessons FOR SELECT
USING (
  is_published = true 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND premium_status = true
  )
);

-- Admins can do everything
CREATE POLICY "Admins can manage lessons"
ON public.premium_lessons FOR ALL
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Update lesson_progress table with resume position
ALTER TABLE public.lesson_progress
  ADD COLUMN IF NOT EXISTS last_position_seconds INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create trigger for updated_at on lesson_progress
CREATE OR REPLACE FUNCTION update_lesson_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lesson_progress_updated_at ON lesson_progress;
CREATE TRIGGER lesson_progress_updated_at
  BEFORE UPDATE ON lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_lesson_progress_timestamp();

-- Function to update lesson progress (atomic operation)
CREATE OR REPLACE FUNCTION public.update_lesson_progress(
  p_lesson_id UUID,
  p_progress_percent INT,
  p_position_seconds INT DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_completed BOOLEAN;
  v_result JSON;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;
  
  -- Mark as completed if progress >= 90%
  v_completed := p_progress_percent >= 90;
  
  INSERT INTO lesson_progress (user_id, lesson_id, progress_percent, last_position_seconds, completed, completed_at)
  VALUES (v_user_id, p_lesson_id, p_progress_percent, p_position_seconds, v_completed, 
          CASE WHEN v_completed THEN NOW() ELSE NULL END)
  ON CONFLICT (user_id, lesson_id) 
  DO UPDATE SET
    progress_percent = GREATEST(lesson_progress.progress_percent, EXCLUDED.progress_percent),
    last_position_seconds = EXCLUDED.last_position_seconds,
    completed = CASE WHEN lesson_progress.completed THEN true ELSE EXCLUDED.completed END,
    completed_at = CASE WHEN lesson_progress.completed THEN lesson_progress.completed_at ELSE EXCLUDED.completed_at END,
    updated_at = NOW();
  
  RETURN json_build_object('success', true, 'completed', v_completed);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_lesson_progress(UUID, INT, INT) TO authenticated;

-- Add unique constraint for lesson_progress if not exists
DO $$ BEGIN
  ALTER TABLE lesson_progress ADD CONSTRAINT lesson_progress_user_lesson_unique 
    UNIQUE (user_id, lesson_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE premium_lessons IS 'Video courses for premium users. Admin-managed.';
