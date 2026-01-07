-- Quest Deduplication & Non-Repetition Verification Script
-- Run in Supabase SQL Editor

-- ==========================================
-- PART 1: FIND DUPLICATE QUESTS
-- ==========================================

-- 1A. Find exact duplicate content (same text)
SELECT 
  content,
  COUNT(*) AS duplicate_count,
  ARRAY_AGG(id) AS duplicate_ids
FROM public.quests
GROUP BY content
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 1B. Find near-duplicate quests (similar first 50 chars)
SELECT 
  LEFT(LOWER(TRIM(content)), 50) AS content_prefix,
  COUNT(*) AS similar_count,
  ARRAY_AGG(id) AS similar_ids
FROM public.quests
GROUP BY LEFT(LOWER(TRIM(content)), 50)
HAVING COUNT(*) > 1
ORDER BY similar_count DESC;

-- ==========================================
-- PART 2: REMOVE DUPLICATES (Keep oldest)
-- ==========================================

-- Preview duplicates to be removed
WITH duplicates AS (
  SELECT 
    id,
    content,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY content ORDER BY created_at ASC) AS rn
  FROM public.quests
)
SELECT id, LEFT(content, 60) AS content_preview, created_at, 'WILL BE DELETED' AS action
FROM duplicates
WHERE rn > 1;

-- Actually delete duplicates (uncomment to run)
-- DELETE FROM public.quests
-- WHERE id IN (
--   SELECT id FROM (
--     SELECT 
--       id,
--       ROW_NUMBER() OVER (PARTITION BY content ORDER BY created_at ASC) AS rn
--     FROM public.quests
--   ) t WHERE rn > 1
-- );

-- ==========================================
-- PART 3: VERIFY NON-REPETITION LOGIC
-- ==========================================

-- 3A. Check if any user got same quest twice within 30 days
SELECT 
  uql.user_id,
  uql.quest_id,
  q.content,
  COUNT(*) AS times_assigned,
  MIN(uql.assignment_date) AS first_assigned,
  MAX(uql.assignment_date) AS last_assigned,
  (MAX(uql.assignment_date) - MIN(uql.assignment_date)) AS days_apart
FROM public.user_quest_log uql
JOIN public.quests q ON uql.quest_id = q.id
GROUP BY uql.user_id, uql.quest_id, q.content
HAVING COUNT(*) > 1
  AND (MAX(uql.assignment_date) - MIN(uql.assignment_date)) < 30
ORDER BY days_apart ASC;

-- 3B. Quest pool health check
SELECT 
  COUNT(*) AS total_quests,
  COUNT(*) FILTER (WHERE is_active = TRUE OR is_active IS NULL) AS active_quests,
  CASE 
    WHEN COUNT(*) >= 30 THEN 'HEALTHY: Pool supports 30-day non-repetition'
    WHEN COUNT(*) >= 10 THEN 'WARNING: Pool close to minimum'
    ELSE 'CRITICAL: Pool too small!'
  END AS status
FROM public.quests;

-- 3C. User quest history depth
SELECT 
  user_id,
  COUNT(DISTINCT quest_id) AS unique_quests_seen,
  COUNT(*) AS total_assignments,
  MIN(assignment_date) AS first_assignment,
  MAX(assignment_date) AS last_assignment
FROM public.user_quest_log
GROUP BY user_id
ORDER BY total_assignments DESC
LIMIT 10;

-- ==========================================
-- PART 4: SUMMARY REPORT
-- ==========================================

SELECT 'Total Quests' AS metric, COUNT(*)::TEXT AS value FROM public.quests
UNION ALL
SELECT 'Active Quests', COUNT(*)::TEXT FROM public.quests WHERE is_active = TRUE OR is_active IS NULL
UNION ALL
SELECT 'Inactive Quests', COUNT(*)::TEXT FROM public.quests WHERE is_active = FALSE
UNION ALL
SELECT 'Total Users with Quests', COUNT(DISTINCT user_id)::TEXT FROM public.user_quest_log
UNION ALL
SELECT 'Repeat Violations (<30 days)', COUNT(*)::TEXT FROM (
  SELECT user_id, quest_id
  FROM public.user_quest_log
  GROUP BY user_id, quest_id
  HAVING COUNT(*) > 1 AND (MAX(assignment_date) - MIN(assignment_date)) < 30
) violations;
