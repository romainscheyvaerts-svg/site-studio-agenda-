-- ============================================
-- SETUP: Pending FREE Bookings Approval System
-- Execute this in Supabase SQL Editor
-- ============================================

-- Table for pending FREE bookings that require admin approval
CREATE TABLE IF NOT EXISTS public.pending_free_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  client_email text NOT NULL,
  client_phone text,
  session_type text NOT NULL,
  session_date date NOT NULL,
  session_time time NOT NULL,
  duration_hours integer NOT NULL DEFAULT 2,
  estimated_price numeric(10,2) NOT NULL DEFAULT 0,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  approval_token uuid NOT NULL DEFAULT gen_random_uuid(),
  reminder_count integer NOT NULL DEFAULT 0,
  first_reminder_sent_at timestamp with time zone,
  second_reminder_sent_at timestamp with time zone,
  third_reminder_sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  responded_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '48 hours')
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_pending_free_bookings_status ON public.pending_free_bookings(status);
CREATE INDEX IF NOT EXISTS idx_pending_free_bookings_token ON public.pending_free_bookings(approval_token);

-- Enable RLS
ALTER TABLE public.pending_free_bookings ENABLE ROW LEVEL SECURITY;

-- Policy for admins to see pending bookings (using correct role names: admin, superadmin)
CREATE POLICY "Admin can view pending bookings" ON public.pending_free_bookings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- Allow service role full access
CREATE POLICY "Service role full access pending" ON public.pending_free_bookings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.pending_free_bookings TO service_role;
GRANT SELECT ON public.pending_free_bookings TO authenticated;

SELECT 'Table pending_free_bookings created successfully!' as result;
