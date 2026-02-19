-- Migration: Add trusted_users table
-- Allows admin to mark certain users as "trusted" for simplified booking

CREATE TABLE IF NOT EXISTS trusted_users (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL UNIQUE,
    trusted_by uuid, -- admin who marked them as trusted
    reason text,
    created_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE trusted_users ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can read all trusted users
CREATE POLICY "Admins can read trusted_users" ON trusted_users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role IN ('admin', 'superadmin')
        )
    );

-- Policy: Admins can insert trusted users
CREATE POLICY "Admins can insert trusted_users" ON trusted_users
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role IN ('admin', 'superadmin')
        )
    );

-- Policy: Admins can delete trusted users
CREATE POLICY "Admins can delete trusted_users" ON trusted_users
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role IN ('admin', 'superadmin')
        )
    );

-- Policy: Users can check if they are trusted (for booking flow)
CREATE POLICY "Users can check own trusted status" ON trusted_users
    FOR SELECT
    USING (user_id = auth.uid());

-- Create index for faster lookups
CREATE INDEX idx_trusted_users_user_id ON trusted_users(user_id);

COMMENT ON TABLE trusted_users IS 'Users marked as trusted by admin - can book with cash payment without identity verification';