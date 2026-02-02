-- Add service_type and total_price columns to session_assignments
-- These fields store the session details that can be modified in the edit panel

ALTER TABLE session_assignments 
ADD COLUMN IF NOT EXISTS service_type TEXT,
ADD COLUMN IF NOT EXISTS total_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS client_name TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comments for documentation
COMMENT ON COLUMN session_assignments.service_type IS 'Type of service: with-engineer, without-engineer, mixing, mastering, etc.';
COMMENT ON COLUMN session_assignments.total_price IS 'Total price for the session in EUR';
COMMENT ON COLUMN session_assignments.client_name IS 'Client name for the session';
COMMENT ON COLUMN session_assignments.notes IS 'Internal notes for the session';
