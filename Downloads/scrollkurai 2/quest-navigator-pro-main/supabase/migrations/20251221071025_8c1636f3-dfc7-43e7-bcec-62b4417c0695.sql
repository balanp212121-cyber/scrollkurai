-- Add Streak Freeze power-up
INSERT INTO public.power_ups (name, description, icon, price, effect_type, effect_value)
VALUES (
  'Streak Freeze',
  'Protect your streak for 24 hours - no quest completion needed',
  '❄️',
  39,
  'streak_freeze',
  1
);

-- Add streak freeze tracking columns to profiles if not exists
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS streak_freeze_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS streak_freeze_expires_at TIMESTAMPTZ DEFAULT NULL;