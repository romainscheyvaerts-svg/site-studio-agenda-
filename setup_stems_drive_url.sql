-- =====================================================
-- Script: setup_stems_drive_url.sql
-- Description: Add stems_drive_url column to instrumentals table
-- This stores the direct Google Drive link to the stems folder
-- =====================================================

-- Add stems_drive_url column to instrumentals table
ALTER TABLE public.instrumentals 
ADD COLUMN IF NOT EXISTS stems_drive_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.instrumentals.stems_drive_url IS 'Direct Google Drive link to the stems folder for this instrumental';

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'instrumentals' 
AND column_name = 'stems_drive_url';
