-- Enable REPLICA IDENTITY FULL for real-time updates
ALTER TABLE public.payment_transactions REPLICA IDENTITY FULL;

-- Add table to real-time publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_transactions;