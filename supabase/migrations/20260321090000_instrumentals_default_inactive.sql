-- Change default value of is_active to false for instrumentals table
-- New instrumentals should be inactive by default (admin must manually activate them)
ALTER TABLE public.instrumentals ALTER COLUMN is_active SET DEFAULT false;