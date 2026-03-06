-- Add sort_order column to instrumentals table for manual ordering
ALTER TABLE public.instrumentals 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Set initial sort_order based on created_at (most recent first = higher number)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
  FROM public.instrumentals
)
UPDATE public.instrumentals i
SET sort_order = n.rn
FROM numbered n
WHERE i.id = n.id;

-- Create index for efficient ordering
CREATE INDEX IF NOT EXISTS idx_instrumentals_sort_order ON public.instrumentals(sort_order);
