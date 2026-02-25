-- Create admin_notifications table for real-time notifications
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL, -- 'booking_cancelled', 'new_booking', 'payment_received', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  client_email TEXT,
  client_name TEXT,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can view notifications
CREATE POLICY "Admins can view notifications"
ON public.admin_notifications
FOR SELECT
USING (is_admin_email((auth.jwt() ->> 'email'::text)));

-- Only admins can update notifications (mark as read)
CREATE POLICY "Admins can update notifications"
ON public.admin_notifications
FOR UPDATE
USING (is_admin_email((auth.jwt() ->> 'email'::text)));

-- Service role can insert notifications
CREATE POLICY "Service role can insert notifications"
ON public.admin_notifications
FOR INSERT
WITH CHECK (true);

-- Index for fast queries
CREATE INDEX idx_admin_notifications_created_at ON public.admin_notifications(created_at DESC);
CREATE INDEX idx_admin_notifications_is_read ON public.admin_notifications(is_read);
CREATE INDEX idx_admin_notifications_type ON public.admin_notifications(type);

-- Add cancelled status to bookings if not exists
-- Add cancellation fields to bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancelled_by TEXT,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Grant permissions
GRANT ALL ON public.admin_notifications TO service_role;
GRANT SELECT, UPDATE ON public.admin_notifications TO authenticated;
