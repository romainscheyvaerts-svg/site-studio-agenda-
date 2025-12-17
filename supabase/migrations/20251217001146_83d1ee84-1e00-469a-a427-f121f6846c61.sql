-- Add custom pricing columns to instrumentals table
ALTER TABLE public.instrumentals 
ADD COLUMN IF NOT EXISTS price_base numeric DEFAULT 100,
ADD COLUMN IF NOT EXISTS price_stems numeric DEFAULT 150,
ADD COLUMN IF NOT EXISTS price_exclusive numeric DEFAULT 500,
ADD COLUMN IF NOT EXISTS has_stems boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS stems_folder_id text;

-- Update existing instrumentals with default prices
UPDATE public.instrumentals SET 
  price_base = COALESCE(price_base, 100),
  price_stems = COALESCE(price_stems, 150),
  price_exclusive = COALESCE(price_exclusive, 500),
  has_stems = COALESCE(has_stems, false)
WHERE price_base IS NULL;