-- Add discount_composition column to sales_config
ALTER TABLE public.sales_config
ADD COLUMN IF NOT EXISTS discount_composition integer DEFAULT 0;