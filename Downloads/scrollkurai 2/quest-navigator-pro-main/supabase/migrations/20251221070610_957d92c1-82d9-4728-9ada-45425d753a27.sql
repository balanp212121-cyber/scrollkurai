-- Add XP booster tracking columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS xp_booster_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS xp_booster_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS xp_booster_expires_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster booster status lookups
CREATE INDEX IF NOT EXISTS idx_profiles_xp_booster_active ON public.profiles(xp_booster_active) WHERE xp_booster_active = true;