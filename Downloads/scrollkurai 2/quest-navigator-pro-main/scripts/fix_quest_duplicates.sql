-- =============================================
-- QUEST AVAILABILITY & DUPLICATE FIX SCRIPT
-- Run this entire script in Supabase SQL Editor
-- =============================================

-- STEP 1: Show all available quests
SELECT 
  id,
  LEFT(content, 60) AS quest_preview,
  target_archetype,
  COALESCE(is_active, TRUE) AS is_active,
  created_at::DATE AS created_date
FROM public.quests
ORDER BY target_archetype, created_at DESC;

-- STEP 2: Count quests by archetype
SELECT 
  target_archetype,
  COUNT(*) AS quest_count
FROM public.quests
GROUP BY target_archetype
ORDER BY quest_count DESC;

-- STEP 3: Find and show duplicates
SELECT 
  'DUPLICATE FOUND' AS status,
  content,
  COUNT(*) AS copies,
  ARRAY_AGG(id ORDER BY created_at) AS all_ids
FROM public.quests
GROUP BY content
HAVING COUNT(*) > 1;

-- STEP 4: FIX DUPLICATES - Delete newer copies, keep oldest
WITH duplicates_to_delete AS (
  SELECT id
  FROM (
    SELECT 
      id,
      content,
      ROW_NUMBER() OVER (PARTITION BY content ORDER BY created_at ASC) AS rn
    FROM public.quests
  ) ranked
  WHERE rn > 1
)
DELETE FROM public.quests
WHERE id IN (SELECT id FROM duplicates_to_delete);

-- STEP 5: Verify fix - should return 0 duplicates
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ NO DUPLICATES - All clean!'
    ELSE '❌ DUPLICATES STILL EXIST'
  END AS duplicate_status
FROM (
  SELECT content
  FROM public.quests
  GROUP BY content
  HAVING COUNT(*) > 1
) dups;

-- STEP 6: Final quest count
SELECT 
  'Total Quests' AS metric, 
  COUNT(*) AS count 
FROM public.quests
UNION ALL
SELECT 
  'Active Quests', 
  COUNT(*) 
FROM public.quests 
WHERE COALESCE(is_active, TRUE) = TRUE;
