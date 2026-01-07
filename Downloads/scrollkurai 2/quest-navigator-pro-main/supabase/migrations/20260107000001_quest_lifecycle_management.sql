-- Add is_active column to quests table for quest lifecycle management
-- This allows deactivating quests without deleting them

-- 1. Add is_active column with default true
ALTER TABLE public.quests
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 2. Add category column for better organization
ALTER TABLE public.quests
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';

-- 3. Add difficulty column (1-5 scale)
ALTER TABLE public.quests
ADD COLUMN IF NOT EXISTS difficulty INTEGER DEFAULT 2;

-- 4. Add xp_base for variable XP rewards per quest
ALTER TABLE public.quests
ADD COLUMN IF NOT EXISTS xp_base INTEGER DEFAULT 250;

-- 5. Add last_assigned_globally for analytics (optional tracking)
ALTER TABLE public.quests
ADD COLUMN IF NOT EXISTS last_assigned_globally TIMESTAMP WITH TIME ZONE;

-- 6. Create index for active quest filtering
CREATE INDEX IF NOT EXISTS idx_quests_active
ON public.quests(is_active) WHERE is_active = TRUE;

-- 7. Create index for category + active filtering
CREATE INDEX IF NOT EXISTS idx_quests_category_active
ON public.quests(category, is_active) WHERE is_active = TRUE;

-- 8. Create view for active quest count (analytics)
CREATE OR REPLACE VIEW public.quest_pool_stats AS
SELECT 
  COUNT(*) FILTER (WHERE is_active = TRUE) AS active_quests,
  COUNT(*) FILTER (WHERE is_active = FALSE) AS inactive_quests,
  COUNT(DISTINCT category) AS categories,
  MIN(created_at) AS oldest_quest,
  MAX(created_at) AS newest_quest
FROM public.quests;

-- 9. Create function to check pool health
CREATE OR REPLACE FUNCTION public.check_quest_pool_health()
RETURNS TABLE(
  total_active INTEGER,
  recommended_minimum INTEGER,
  is_healthy BOOLEAN,
  warning_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  active_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO active_count FROM public.quests WHERE is_active = TRUE;
  
  RETURN QUERY SELECT 
    active_count,
    30::INTEGER,
    (active_count >= 30),
    CASE
      WHEN active_count < 10 THEN 'CRITICAL: Quest pool too small for 30-day non-repetition'
      WHEN active_count < 30 THEN 'WARNING: Quest pool below recommended minimum'
      ELSE 'OK: Quest pool is healthy'
    END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_quest_pool_health() TO authenticated;
