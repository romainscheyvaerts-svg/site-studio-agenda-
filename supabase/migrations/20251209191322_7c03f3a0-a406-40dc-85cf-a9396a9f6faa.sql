-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user is admin by email
CREATE OR REPLACE FUNCTION public.is_admin_email(_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _email = 'prod.makemusic@gmail.com'
$$;

-- RLS Policies for user_roles
-- Only admins can view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

-- Only admins can insert roles
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update roles
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete roles
CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create promo_codes table to manage codes via admin panel
CREATE TABLE public.promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    full_calendar_visibility BOOLEAN NOT NULL DEFAULT false,
    skip_payment BOOLEAN NOT NULL DEFAULT false,
    skip_identity_verification BOOLEAN NOT NULL DEFAULT false,
    skip_form_fields BOOLEAN NOT NULL DEFAULT false,
    auto_select_service TEXT,
    discount_recording NUMERIC DEFAULT 0,
    discount_rental NUMERIC DEFAULT 0,
    discount_mixing NUMERIC DEFAULT 0,
    discount_mastering NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on promo_codes
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Everyone can read active promo codes (needed for validation)
CREATE POLICY "Anyone can read promo codes"
ON public.promo_codes
FOR SELECT
USING (true);

-- Only admins can insert promo codes
CREATE POLICY "Admins can insert promo codes"
ON public.promo_codes
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update promo codes
CREATE POLICY "Admins can update promo codes"
ON public.promo_codes
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete promo codes
CREATE POLICY "Admins can delete promo codes"
ON public.promo_codes
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Insert initial promo codes (migrating from secret config, excluding kazam1040 and lennon77723)
INSERT INTO public.promo_codes (code, is_active, full_calendar_visibility, skip_payment, skip_identity_verification, skip_form_fields, auto_select_service, discount_recording, discount_rental, discount_mixing, discount_mastering) VALUES
('vip777', true, true, true, true, false, NULL, 0, 0, 0, 0),
('gold50', true, false, false, false, false, NULL, 40, 15, 50, 50),
('vip50', true, false, false, true, false, NULL, 40, 15, 50, 50),
('cashonly777', true, false, true, false, false, NULL, 0, 0, 0, 0);

-- Create trigger to update updated_at
CREATE TRIGGER update_promo_codes_updated_at
BEFORE UPDATE ON public.promo_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();