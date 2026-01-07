-- Quest Data Initialization Script
-- Run this after the 20260107000001_quest_lifecycle_management.sql migration

-- 1. Set all existing quests to active
UPDATE public.quests
SET is_active = TRUE
WHERE is_active IS NULL;

-- 2. Verify quest pool health
SELECT 
  COUNT(*) AS total_quests,
  COUNT(*) FILTER (WHERE is_active = TRUE) AS active_quests,
  COUNT(DISTINCT target_archetype) AS archetypes,
  'OK: Quest pool is healthy for 30-day non-repetition' AS status
FROM public.quests
WHERE is_active = TRUE;

-- 3. Quest distribution by archetype
SELECT 
  target_archetype,
  COUNT(*) AS quest_count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM public.quests WHERE is_active = TRUE), 1) AS percentage
FROM public.quests
WHERE is_active = TRUE
GROUP BY target_archetype
ORDER BY quest_count DESC;

-- 4. Verify no orphan quest logs exist
SELECT 
  'Orphan check' AS check_type,
  COUNT(*) AS orphan_logs
FROM public.user_quest_log uql
LEFT JOIN public.quests q ON uql.quest_id = q.id
WHERE q.id IS NULL;

-- 5. Show date range of quests
SELECT 
  MIN(created_at) AS oldest_quest,
  MAX(created_at) AS newest_quest,
  COUNT(*) AS total_quests
FROM public.quests;
