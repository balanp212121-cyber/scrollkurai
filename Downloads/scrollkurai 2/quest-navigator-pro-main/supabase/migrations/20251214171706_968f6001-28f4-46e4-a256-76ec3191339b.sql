-- Create table for user avatar selections
CREATE TABLE public.user_avatars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  avatar_type TEXT NOT NULL DEFAULT 'default', -- 'default', 'preset', 'custom'
  avatar_url TEXT,
  avatar_preset TEXT, -- preset avatar identifier
  border_color TEXT, -- premium border color
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_avatars ENABLE ROW LEVEL SECURITY;

-- Users can view their own avatar
CREATE POLICY "Users can view their own avatar"
ON public.user_avatars FOR SELECT
USING (auth.uid() = user_id);

-- Premium users can insert/update their avatar
CREATE POLICY "Premium users can insert their avatar"
ON public.user_avatars FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND premium_status = true)
);

CREATE POLICY "Premium users can update their avatar"
ON public.user_avatars FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id AND 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND premium_status = true)
);

-- Allow public viewing of avatars for leaderboards etc
CREATE POLICY "Anyone can view user avatars"
ON public.user_avatars FOR SELECT
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_user_avatars_updated_at
BEFORE UPDATE ON public.user_avatars
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();