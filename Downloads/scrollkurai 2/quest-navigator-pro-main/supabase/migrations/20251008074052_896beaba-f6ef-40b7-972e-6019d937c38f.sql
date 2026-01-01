-- Add premium features columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS premium_status boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS push_token text;

-- Create reflections_analysis table for AI insights
CREATE TABLE IF NOT EXISTS public.reflections_analysis (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_quest_log_id uuid NOT NULL REFERENCES public.user_quest_log(id) ON DELETE CASCADE,
  sentiment_score numeric,
  insights text,
  suggested_next_quest text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reflections_analysis ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own reflection analyses
CREATE POLICY "Users can view their own reflection analyses"
ON public.reflections_analysis
FOR SELECT
USING (
  user_quest_log_id IN (
    SELECT id FROM public.user_quest_log WHERE user_id = auth.uid()
  )
);

-- Create policy for inserting reflection analyses (from edge functions)
CREATE POLICY "Service role can insert reflection analyses"
ON public.reflections_analysis
FOR INSERT
WITH CHECK (true);