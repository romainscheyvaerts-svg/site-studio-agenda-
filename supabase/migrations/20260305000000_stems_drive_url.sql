-- Add stems_drive_url column to instrumentals table
-- This stores the direct Google Drive link to the stems folder for each instrumental
ALTER TABLE public.instrumentals 
ADD COLUMN IF NOT EXISTS stems_drive_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.instrumentals.stems_drive_url IS 'Direct Google Drive link to the stems folder for this instrumental';
