-- Enable realtime for profiles table to allow instant UI updates when premium status changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;