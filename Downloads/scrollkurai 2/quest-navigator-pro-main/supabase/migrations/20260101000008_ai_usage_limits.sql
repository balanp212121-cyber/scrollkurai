-- Create AI Usage Tracking Table
CREATE TABLE IF NOT EXISTS ai_daily_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  usage_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);

-- RLS Policies
ALTER TABLE ai_daily_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON ai_daily_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service Role/RPC is needed for updates if we want strict control
-- We will use a SECURITY DEFINER function to handle the increment logic
-- ensuring that the logic is encapsulated and safe.

CREATE OR REPLACE FUNCTION increment_ai_usage(p_user_id UUID, p_date DATE)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_count INT;
BEGIN
  -- Atomic UPSERT to increment usage
  INSERT INTO ai_daily_usage (user_id, usage_date, usage_count)
  VALUES (p_user_id, p_date, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET usage_count = ai_daily_usage.usage_count + 1
  RETURNING usage_count INTO new_count;

  RETURN new_count;
END;
$$;

-- Grant execute to authenticated users (so they can call it via client for checking? 
-- No, the Edge Function will call it using Service Role or User token. 
-- If User token, they need permission.
GRANT EXECUTE ON FUNCTION increment_ai_usage TO authenticated;
GRANT EXECUTE ON FUNCTION increment_ai_usage TO service_role;
