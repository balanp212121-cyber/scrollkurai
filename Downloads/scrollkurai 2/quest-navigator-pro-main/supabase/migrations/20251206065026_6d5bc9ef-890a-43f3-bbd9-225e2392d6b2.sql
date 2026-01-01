-- Add unique constraint on user_id for subscriptions table to support upsert
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id);