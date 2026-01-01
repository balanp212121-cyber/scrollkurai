-- Create table for storing push notification tokens
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, token)
);

-- RLS
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can see their own tokens
CREATE POLICY "Users can view own tokens"
    ON public.user_push_tokens FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own tokens
CREATE POLICY "Users can insert own tokens"
    ON public.user_push_tokens FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own tokens (on logout/settings)
CREATE POLICY "Users can delete own tokens"
    ON public.user_push_tokens FOR DELETE
    USING (auth.uid() = user_id);

-- Index for faster lookups when sending notifications
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON public.user_push_tokens(user_id);
