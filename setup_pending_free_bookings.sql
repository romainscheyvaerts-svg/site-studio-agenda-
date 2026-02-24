-- ============================================
-- SETUP: Pending FREE Bookings Approval System
-- Execute this in Supabase SQL Editor
-- ============================================

-- Table for pending FREE bookings that require admin approval
CREATE TABLE IF NOT EXISTS public.pending_free_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Booking details
  client_name text NOT NULL,
  client_email text NOT NULL,
  client_phone text,
  session_type text NOT NULL,
  session_date date NOT NULL,
  session_time time NOT NULL,
  duration_hours integer NOT NULL DEFAULT 2,
  estimated_price numeric(10,2) NOT NULL DEFAULT 0,
  message text,
  -- Approval status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  approval_token uuid NOT NULL DEFAULT gen_random_uuid(),
  -- Reminder tracking
  reminder_count integer NOT NULL DEFAULT 0,
  first_reminder_sent_at timestamp with time zone,
  second_reminder_sent_at timestamp with time zone,
  third_reminder_sent_at timestamp with time zone,
  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  responded_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '48 hours')
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_pending_free_bookings_status ON public.pending_free_bookings(status);
CREATE INDEX IF NOT EXISTS idx_pending_free_bookings_token ON public.pending_free_bookings(approval_token);
CREATE INDEX IF NOT EXISTS idx_pending_free_bookings_expires ON public.pending_free_bookings(expires_at);

-- Enable RLS
ALTER TABLE public.pending_free_bookings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admin can view pending bookings" ON public.pending_free_bookings;
DROP POLICY IF EXISTS "Service role full access" ON public.pending_free_bookings;

-- Admins can see all pending bookings
CREATE POLICY "Admin can view pending bookings" ON public.pending_free_bookings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Allow service role full access
CREATE POLICY "Service role full access" ON public.pending_free_bookings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.pending_free_bookings TO service_role;
GRANT SELECT ON public.pending_free_bookings TO authenticated;

-- Test insert (optionnel - à supprimer en production)
-- INSERT INTO public.pending_free_bookings (client_name, client_email, session_type, session_date, session_time, duration_hours)
-- VALUES ('Test Client', 'test@example.com', 'with-engineer', '2026-02-25', '14:00', 2);

SELECT 'Table pending_free_bookings created successfully!' as result;

-- Verify the table exists
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'pending_free_bookings' 
ORDER BY ordinal_position;
