-- Add per-service discount percentages to sales_config
ALTER TABLE public.sales_config 
ADD COLUMN IF NOT EXISTS discount_with_engineer numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_without_engineer numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_mixing numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_mastering numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_analog_mastering numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_podcast numeric DEFAULT 0;

-- Update existing rows to use the general discount_percentage for all services
UPDATE public.sales_config 
SET 
  discount_with_engineer = discount_percentage,
  discount_without_engineer = discount_percentage,
  discount_mixing = discount_percentage,
  discount_mastering = discount_percentage,
  discount_analog_mastering = discount_percentage,
  discount_podcast = discount_percentage
WHERE discount_percentage > 0;