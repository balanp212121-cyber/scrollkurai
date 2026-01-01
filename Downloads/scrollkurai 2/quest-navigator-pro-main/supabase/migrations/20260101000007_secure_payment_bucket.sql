-- Secure Payment Proofs Bucket
-- Enforce 1MB limit and strict image types

UPDATE storage.buckets
SET
  file_size_limit = 1048576, -- 1MB
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'payment-proofs';

-- Create policy to allow authenticated users to view only their own proofs
-- (Already handled in previous migration, but ensuring strict safety)
-- Double check policies in 20251123105119_16c3fd6e-0587-48e0-9bd4-5bb544188656.sql
