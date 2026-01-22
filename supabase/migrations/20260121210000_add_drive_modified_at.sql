-- Add drive_modified_at column to track when files were last modified in Google Drive
-- This allows detecting updated files during synchronization

ALTER TABLE instrumentals
ADD COLUMN IF NOT EXISTS drive_modified_at TIMESTAMPTZ;

-- Add comment to explain the column
COMMENT ON COLUMN instrumentals.drive_modified_at IS 'Timestamp of when the file was last modified in Google Drive. Used to detect file updates during sync.';
