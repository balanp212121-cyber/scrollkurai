-- Set REPLICA IDENTITY FULL for profiles table to ensure complete row data in realtime updates
ALTER TABLE public.profiles REPLICA IDENTITY FULL;