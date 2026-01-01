
-- Daily Quest Reliability Fix
-- Goal: Deterministic "One Quest Per Day" regardless of timezone

-- 1. Add assignment_date column (DATE type, distinct from timestamp)
ALTER TABLE public.user_quest_log 
ADD COLUMN IF NOT EXISTS assignment_date DATE;

-- 2. Backfill existing data using the user's apparent local day (approximated by created_at)
-- This ensures unique constraint won't fail on existing data
UPDATE public.user_quest_log
SET assignment_date = created_at::DATE
WHERE assignment_date IS NULL;

-- 3. Enforce not null after backfill
ALTER TABLE public.user_quest_log 
ALTER COLUMN assignment_date SET NOT NULL;

-- 4. Add Unique Constraint to guarantee idempotency
-- "A user can have only one quest log entry per calendar date"
ALTER TABLE public.user_quest_log
ADD CONSTRAINT unique_user_daily_quest UNIQUE (user_id, assignment_date);

-- 5. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_quest_log_date 
ON public.user_quest_log(user_id, assignment_date);
