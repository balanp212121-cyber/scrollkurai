-- Run this SQL in your Supabase SQL Editor to rename "Streak Shield" to "Streak Insurance"
UPDATE power_ups 
SET name = 'Streak Insurance' 
WHERE effect_type = 'streak_save' OR name = 'Streak Shield';
