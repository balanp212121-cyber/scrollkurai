-- Create table to track notification history for rate limiting and deduplication
CREATE TABLE IF NOT EXISTS public.notification_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_context JSONB,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notification history"
ON public.notification_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert notification history"
ON public.notification_history FOR INSERT
WITH CHECK (true);

-- Add index for efficient lookups
CREATE INDEX idx_notification_history_user_event ON public.notification_history(user_id, event_type, sent_at DESC);

-- Add notification frequency preference to notification_preferences
ALTER TABLE public.notification_preferences 
ADD COLUMN IF NOT EXISTS notification_frequency TEXT DEFAULT 'normal' CHECK (notification_frequency IN ('minimal', 'normal', 'frequent'));