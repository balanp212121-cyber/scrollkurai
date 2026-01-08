-- =============================================
-- CANONICAL POWER-UP SYSTEM MIGRATION (FINAL - PART 3: Grants)
-- =============================================

DO $$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.use_powerup_atomic TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.use_powerup_atomic TO service_role';

  EXECUTE 'GRANT EXECUTE ON FUNCTION public.complete_quest_atomic TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.complete_quest_atomic TO service_role';
END $$;
