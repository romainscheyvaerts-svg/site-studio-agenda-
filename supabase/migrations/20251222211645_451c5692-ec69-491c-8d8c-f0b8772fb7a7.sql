-- Table pour stocker les réservations du nouveau système
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  session_type TEXT NOT NULL,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_hours INTEGER NOT NULL,
  amount_paid NUMERIC NOT NULL,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending_validation',
  has_conflict BOOLEAN NOT NULL DEFAULT false,
  conflict_resolved BOOLEAN DEFAULT false,
  google_calendar_event_id TEXT,
  admin_notes TEXT,
  validation_token TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour les recherches fréquentes
CREATE INDEX idx_bookings_date ON public.bookings(session_date);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_validation_token ON public.bookings(validation_token);

-- Enable RLS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage all bookings"
ON public.bookings
FOR ALL
USING (is_admin_email((auth.jwt() ->> 'email'::text)));

CREATE POLICY "Service role can manage bookings"
ON public.bookings
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view their own bookings"
ON public.bookings
FOR SELECT
USING (client_email = (auth.jwt() ->> 'email'::text));

-- Trigger for updated_at
CREATE TRIGGER update_bookings_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();