-- Add is_premium_only flag to badges table
ALTER TABLE public.badges
ADD COLUMN is_premium_only BOOLEAN NOT NULL DEFAULT false;

-- Create themes table for premium themes
CREATE TABLE public.premium_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  is_premium_only BOOLEAN NOT NULL DEFAULT true,
  color_primary TEXT NOT NULL,
  color_accent TEXT NOT NULL,
  color_background TEXT NOT NULL,
  preview_image TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_theme_selection table
CREATE TABLE public.user_theme_selection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_id UUID NOT NULL REFERENCES premium_themes(id) ON DELETE CASCADE,
  selected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on new tables
ALTER TABLE public.premium_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_theme_selection ENABLE ROW LEVEL SECURITY;

-- RLS Policies for premium_themes
CREATE POLICY "Anyone can view themes"
  ON public.premium_themes
  FOR SELECT
  USING (true);

-- RLS Policies for user_theme_selection
CREATE POLICY "Users can view their own theme selection"
  ON public.user_theme_selection
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Premium users can update their theme selection"
  ON public.user_theme_selection
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND premium_status = true
    )
  );

CREATE POLICY "Premium users can change their theme"
  ON public.user_theme_selection
  FOR UPDATE
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND premium_status = true
    )
  );

-- Insert premium badges
INSERT INTO public.badges (name, description, icon, requirement_type, requirement_value, is_premium_only) VALUES
  ('Diamond Elite', 'Premium exclusive - For the elite warriors', '💎', 'premium_unlock', 1, true),
  ('Golden Crown', 'Premium exclusive - Royalty status achieved', '👑', 'premium_unlock', 1, true),
  ('Platinum Star', 'Premium exclusive - Shine bright like a star', '⭐', 'premium_unlock', 1, true),
  ('Crystal Warrior', 'Premium exclusive - Pure dedication', '🔮', 'xp', 5000, true),
  ('Cosmic Legend', 'Premium exclusive - Beyond limits', '🌌', 'level', 50, true);

-- Insert default and premium themes
INSERT INTO public.premium_themes (name, display_name, description, is_premium_only, color_primary, color_accent, color_background) VALUES
  ('default', 'Default Theme', 'Classic ScrollKurai look', false, 'hsl(142, 76%, 36%)', 'hsl(142, 71%, 45%)', 'hsl(222.2, 84%, 4.9%)'),
  ('midnight-ocean', 'Midnight Ocean', 'Deep blue serenity', true, 'hsl(210, 90%, 50%)', 'hsl(190, 80%, 45%)', 'hsl(220, 90%, 8%)'),
  ('sunset-glow', 'Sunset Glow', 'Warm orange and pink vibes', true, 'hsl(15, 85%, 55%)', 'hsl(340, 75%, 60%)', 'hsl(25, 40%, 12%)'),
  ('forest-zen', 'Forest Zen', 'Natural green harmony', true, 'hsl(145, 70%, 40%)', 'hsl(165, 65%, 45%)', 'hsl(150, 30%, 10%)'),
  ('royal-purple', 'Royal Purple', 'Majestic and powerful', true, 'hsl(270, 75%, 50%)', 'hsl(290, 70%, 55%)', 'hsl(265, 50%, 10%)'),
  ('golden-hour', 'Golden Hour', 'Luxurious gold and amber', true, 'hsl(45, 90%, 55%)', 'hsl(30, 85%, 50%)', 'hsl(40, 40%, 12%)');