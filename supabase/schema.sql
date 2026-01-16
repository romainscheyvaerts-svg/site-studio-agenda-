-- Create table to store client Drive folders
CREATE TABLE public.client_drive_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  client_name TEXT NOT NULL,
  drive_folder_id TEXT NOT NULL,
  drive_folder_link TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_email)
);

-- Enable Row Level Security
ALTER TABLE public.client_drive_folders ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access only (edge functions)
CREATE POLICY "Service role can manage client folders"
ON public.client_drive_folders
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_client_drive_folders_email ON public.client_drive_folders(client_email);
CREATE INDEX idx_client_drive_folders_phone ON public.client_drive_folders(client_phone);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_client_drive_folders_updated_at
BEFORE UPDATE ON public.client_drive_folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();-- Drop existing policy
DROP POLICY IF EXISTS "Service role can manage client folders" ON public.client_drive_folders;

-- Create restrictive policy: only service role can access (no public/authenticated access)
-- Since edge functions use service_role key which bypasses RLS, we just need to deny all other access

-- Policy to deny all access to regular users (authenticated or anonymous)
-- By not having any permissive SELECT policy, no one can read the data except service role
CREATE POLICY "Only service role can access client folders"
ON public.client_drive_folders
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);-- Drop the existing restrictive policy that blocks everything
DROP POLICY IF EXISTS "Only service role can access client folders" ON public.client_drive_folders;

-- Create policy to allow authenticated users to see only their own folders (based on email match)
CREATE POLICY "Users can view their own drive folders"
ON public.client_drive_folders
FOR SELECT
TO authenticated
USING (client_email = auth.jwt() ->> 'email');

-- Block all anonymous access
CREATE POLICY "Deny anonymous access"
ON public.client_drive_folders
FOR SELECT
TO anon
USING (false);

-- Allow service role to insert (for edge functions creating folders)
CREATE POLICY "Service role can insert folders"
ON public.client_drive_folders
FOR INSERT
TO service_role
WITH CHECK (true);

-- Allow service role to update folders
CREATE POLICY "Service role can update folders"
ON public.client_drive_folders
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Allow service role to select (for edge functions checking existing folders)
CREATE POLICY "Service role can select folders"
ON public.client_drive_folders
FOR SELECT
TO service_role
USING (true);-- Create enum for app roles
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
EXECUTE FUNCTION public.update_updated_at_column();-- Fix PUBLIC_DATA_EXPOSURE: Remove public read access to promo_codes table
-- The validate-promo-code edge function uses service role and will still work

-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can read promo codes" ON public.promo_codes;

-- Add admin-only SELECT policy for the AdminPanel
CREATE POLICY "Admins can read promo codes"
ON public.promo_codes
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));-- Table des instrumentaux
CREATE TABLE public.instrumentals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  genre TEXT,
  bpm INTEGER,
  key TEXT,
  preview_url TEXT, -- URL du fichier preview (mp3 basse qualité)
  cover_image_url TEXT,
  drive_file_id TEXT NOT NULL, -- ID du fichier Google Drive HQ
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des types de licences
CREATE TABLE public.instrumental_licenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, -- Basic, Premium, Exclusive
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  features TEXT[], -- Liste des avantages
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des achats d'instrumentaux
CREATE TABLE public.instrumental_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  instrumental_id UUID NOT NULL REFERENCES public.instrumentals(id),
  license_id UUID NOT NULL REFERENCES public.instrumental_licenses(id),
  payment_id TEXT, -- Stripe/PayPal payment ID
  payment_method TEXT, -- stripe, paypal
  amount_paid DECIMAL(10,2) NOT NULL,
  download_token TEXT NOT NULL UNIQUE,
  download_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  buyer_email TEXT NOT NULL,
  buyer_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.instrumentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instrumental_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instrumental_purchases ENABLE ROW LEVEL SECURITY;

-- Instrumentals: public read, admin write
CREATE POLICY "Anyone can view active instrumentals"
ON public.instrumentals FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage instrumentals"
ON public.instrumentals FOR ALL
USING (public.is_admin_email(auth.jwt()->>'email'));

-- Licenses: public read, admin write
CREATE POLICY "Anyone can view active licenses"
ON public.instrumental_licenses FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage licenses"
ON public.instrumental_licenses FOR ALL
USING (public.is_admin_email(auth.jwt()->>'email'));

-- Purchases: users see own, admin sees all
CREATE POLICY "Users can view own purchases"
ON public.instrumental_purchases FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert purchases"
ON public.instrumental_purchases FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view all purchases"
ON public.instrumental_purchases FOR SELECT
USING (public.is_admin_email(auth.jwt()->>'email'));

-- Insert default licenses
INSERT INTO public.instrumental_licenses (name, description, price, features, sort_order) VALUES
('Basic', 'Licence de base pour usage non-commercial', 29.00, ARRAY['MP3 + WAV haute qualité', 'Usage streaming (Spotify, Apple Music)', 'Jusqu''à 10 000 streams', 'Crédit obligatoire'], 1),
('Premium', 'Licence complète pour artistes', 79.00, ARRAY['MP3 + WAV + Stems', 'Usage streaming illimité', 'Usage vidéo (YouTube, TikTok)', 'Distribution digitale', 'Crédit recommandé'], 2),
('Exclusive', 'Licence exclusive - vous êtes le seul propriétaire', 299.00, ARRAY['Tous les fichiers sources', 'Droits exclusifs complets', 'Retrait de la vente', 'Usage commercial illimité', 'Aucun crédit requis'], 3);

-- Trigger for updated_at
CREATE TRIGGER update_instrumentals_updated_at
BEFORE UPDATE ON public.instrumentals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();-- Table des services avec prix de base
CREATE TABLE public.services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_key text NOT NULL UNIQUE,
  name_fr text NOT NULL,
  base_price numeric NOT NULL,
  price_unit text NOT NULL DEFAULT 'fixed', -- 'hourly' or 'fixed'
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Table de configuration des soldes/promotions
CREATE TABLE public.sales_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_active boolean NOT NULL DEFAULT false,
  sale_name text NOT NULL DEFAULT 'Promotion',
  discount_percentage numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_config ENABLE ROW LEVEL SECURITY;

-- Policies for services - anyone can read, only admins can modify
CREATE POLICY "Anyone can view services" ON public.services FOR SELECT USING (true);
CREATE POLICY "Admins can manage services" ON public.services FOR ALL USING (is_admin_email((auth.jwt() ->> 'email'::text)));

-- Policies for sales_config - anyone can read, only admins can modify  
CREATE POLICY "Anyone can view sales config" ON public.sales_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage sales config" ON public.sales_config FOR ALL USING (is_admin_email((auth.jwt() ->> 'email'::text)));

-- Insert default services
INSERT INTO public.services (service_key, name_fr, base_price, price_unit, sort_order) VALUES
  ('with-engineer', 'Session avec Ingénieur Son', 45, 'hourly', 1),
  ('without-engineer', 'Location Dry (sans ingénieur)', 22, 'hourly', 2),
  ('mixing', 'Mixage', 200, 'fixed', 3),
  ('mastering', 'Mastering Numérique', 60, 'fixed', 4),
  ('analog-mastering', 'Mastering Analogique', 100, 'fixed', 5);

-- Insert default sales config (disabled)
INSERT INTO public.sales_config (is_active, sale_name, discount_percentage) VALUES (false, 'Promotion', 0);

-- Trigger for updated_at
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_config_updated_at
  BEFORE UPDATE ON public.sales_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Ajouter des colonnes pour prix fixes personnalisés et acompte obligatoire
ALTER TABLE public.promo_codes 
ADD COLUMN IF NOT EXISTS custom_price_with_engineer numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS custom_price_without_engineer numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS require_full_payment boolean DEFAULT false;

-- Mettre à jour le code prixdami777 avec les prix spéciaux
UPDATE public.promo_codes 
SET 
  custom_price_with_engineer = 20,
  custom_price_without_engineer = 10,
  require_full_payment = true
WHERE code = 'prixdami777';-- Table for blocked users
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  blocked_at timestamp with time zone NOT NULL DEFAULT now(),
  blocked_by text NOT NULL,
  reason text
);

-- Enable RLS
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Only admins can manage blocked users
CREATE POLICY "Admins can manage blocked users"
ON public.blocked_users
FOR ALL
USING (is_admin_email((auth.jwt() ->> 'email'::text)));

-- Table for chatbot configuration
CREATE TABLE IF NOT EXISTS public.chatbot_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  system_prompt text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chatbot_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read chatbot config (for the chatbot to work)
CREATE POLICY "Anyone can read chatbot config"
ON public.chatbot_config
FOR SELECT
USING (true);

-- Only admins can modify chatbot config
CREATE POLICY "Admins can manage chatbot config"
ON public.chatbot_config
FOR ALL
USING (is_admin_email((auth.jwt() ->> 'email'::text)));

-- Insert default chatbot prompt
INSERT INTO public.chatbot_config (system_prompt)
VALUES ('Tu es l''assistant virtuel de Make Music Studio, un studio d''enregistrement haut de gamme situé à Bruxelles (Rue du Sceptre 22, 1050 Ixelles). 

## Équipement du studio:
- Microphone: Neumann U87
- Préampli SSL
- Interface SSL
- Monitoring: Genelec avec subwoofer
- DAW: ProTools
- Plugins: UAD, Waves, Soundtoys, Antares (Auto-Tune), SSL, Slate Digital

## Services et tarifs:
- Session avec ingénieur son: 45€/h (acompte 50%)
- Location sèche (sans ingénieur): 22€/h (paiement complet)
- Mixage: 200€/projet (acompte 50%)
- Mastering numérique: 60€ (acompte 50%)
- Mastering analogique: 100€/piste (paiement complet)
- Mixage podcast: 40€/minute audio

## Ta mission:
- Répondre aux questions sur le studio et ses services
- Qualifier les projets des clients
- Conseiller sur le choix de prestation adapté
- Rediriger vers la réservation quand approprié

Sois professionnel, chaleureux et expert. Tu représentes un studio haut de gamme.')
ON CONFLICT DO NOTHING;-- Add per-service discount percentages to sales_config
ALTER TABLE public.sales_config 
ADD COLUMN IF NOT EXISTS discount_with_engineer numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_without_engineer numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_mixing numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_mastering numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_analog_mastering numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_podcast numeric DEFAULT 0;

-- Update existing rows to use the general discount_percentage for all services
UPDATE public.sales_config 
SET 
  discount_with_engineer = discount_percentage,
  discount_without_engineer = discount_percentage,
  discount_mixing = discount_percentage,
  discount_mastering = discount_percentage,
  discount_analog_mastering = discount_percentage,
  discount_podcast = discount_percentage
WHERE discount_percentage > 0;-- Create activity_logs table for tracking user/visitor actions
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  country text,
  action text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  path text,
  user_agent text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create blocked_ips table for IP blocking
CREATE TABLE public.blocked_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL UNIQUE,
  reason text,
  blocked_by text NOT NULL,
  blocked_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;

-- Admin policies for activity_logs
CREATE POLICY "Admins can view activity logs" ON public.activity_logs
  FOR SELECT USING (is_admin_email((auth.jwt() ->> 'email'::text)));

CREATE POLICY "Service role can insert activity logs" ON public.activity_logs
  FOR INSERT WITH CHECK (true);

-- Admin policies for blocked_ips
CREATE POLICY "Admins can manage blocked IPs" ON public.blocked_ips
  FOR ALL USING (is_admin_email((auth.jwt() ->> 'email'::text)));

-- Create index for faster queries
CREATE INDEX idx_activity_logs_ip ON public.activity_logs(ip_address);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_blocked_ips_ip ON public.blocked_ips(ip_address);-- Add custom pricing columns to instrumentals table
ALTER TABLE public.instrumentals 
ADD COLUMN IF NOT EXISTS price_base numeric DEFAULT 100,
ADD COLUMN IF NOT EXISTS price_stems numeric DEFAULT 150,
ADD COLUMN IF NOT EXISTS price_exclusive numeric DEFAULT 500,
ADD COLUMN IF NOT EXISTS has_stems boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS stems_folder_id text;

-- Update existing instrumentals with default prices
UPDATE public.instrumentals SET 
  price_base = COALESCE(price_base, 100),
  price_stems = COALESCE(price_stems, 150),
  price_exclusive = COALESCE(price_exclusive, 500),
  has_stems = COALESCE(has_stems, false)
WHERE price_base IS NULL;-- Table pour stocker les réservations du nouveau système
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
EXECUTE FUNCTION public.update_updated_at_column();-- Create gallery_photos table for managing studio gallery images
CREATE TABLE public.gallery_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.gallery_photos ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view active gallery photos
CREATE POLICY "Anyone can view active gallery photos"
ON public.gallery_photos
FOR SELECT
USING (is_active = true);

-- Policy: Admins can manage all gallery photos
CREATE POLICY "Admins can manage gallery photos"
ON public.gallery_photos
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_gallery_photos_updated_at
BEFORE UPDATE ON public.gallery_photos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for gallery photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('gallery', 'gallery', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for gallery bucket
CREATE POLICY "Gallery images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'gallery');

CREATE POLICY "Admins can upload gallery images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'gallery' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete gallery images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'gallery' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);-- Create table for service features
CREATE TABLE public.service_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_key TEXT NOT NULL,
  feature_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_features ENABLE ROW LEVEL SECURITY;

-- Anyone can view active features
CREATE POLICY "Anyone can view active service features"
ON public.service_features
FOR SELECT
USING (is_active = true);

-- Admins can manage features
CREATE POLICY "Admins can manage service features"
ON public.service_features
FOR ALL
USING (is_admin_email((auth.jwt() ->> 'email'::text)));

-- Create trigger for updated_at
CREATE TRIGGER update_service_features_updated_at
BEFORE UPDATE ON public.service_features
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default features for each service
INSERT INTO public.service_features (service_key, feature_text, sort_order) VALUES
-- with-engineer
('with-engineer', 'Ingénieur son dédié', 1),
('with-engineer', 'Mix en temps réel', 2),
('with-engineer', 'Conseils artistiques', 3),
('with-engineer', 'Export multipistes', 4),

-- without-engineer
('without-engineer', 'Studio en autonomie', 1),
('without-engineer', 'Équipement inclus', 2),
('without-engineer', 'Accès 24/7 possible', 3),
('without-engineer', 'Support technique', 4),

-- mixing
('mixing', 'Mix professionnel', 1),
('mixing', 'Mastering inclus (60€)', 2),
('mixing', 'Révisions incluses', 3),
('mixing', 'Plugins premium', 4),
('mixing', 'Lien Drive envoyé par mail', 5),

-- mastering
('mastering', 'Traitement numérique', 1),
('mastering', 'Loudness optimisé', 2),
('mastering', 'Format streaming', 3),
('mastering', 'Fichier WAV + MP3', 4),

-- analog-mastering
('analog-mastering', 'Console SSL', 1),
('analog-mastering', 'Couleur analogique', 2),
('analog-mastering', 'Loudness optimisé', 3),
('analog-mastering', 'Session d''écoute studio', 4),

-- podcast
('podcast', 'Nettoyage audio', 1),
('podcast', 'Égalisation voix', 2),
('podcast', 'Montage si nécessaire', 3),
('podcast', 'Export optimisé podcast', 4);CREATE OR REPLACE FUNCTION public.is_admin_email(_email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _email IN (
    'prod.makemusic@gmail.com',
    'kazamzamka@gmail.com',
    'romain.scheyvaerts@gmail.com'
  )
$function$;CREATE OR REPLACE FUNCTION public.is_admin_email(_email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT _email IN (
    'prod.makemusic@gmail.com',
    'romain.scheyvaerts@gmail.com'
  )
$$;-- Create a table to store site configuration including DAW URL
CREATE TABLE public.site_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

-- Everyone can read config (for DAW URL)
CREATE POLICY "Anyone can read site config"
ON public.site_config
FOR SELECT
USING (true);

-- Only admins can update config
CREATE POLICY "Admins can update site config"
ON public.site_config
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can insert config
CREATE POLICY "Admins can insert site config"
ON public.site_config
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_site_config_updated_at
BEFORE UPDATE ON public.site_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default DAW URL
INSERT INTO public.site_config (config_key, config_value, description)
VALUES ('daw_url', 'https://glowing-space-umbrella-v69756456w74hwvpv-3000.app.github.dev/', 'URL du DAW Nova Studio externe');-- Fix 1: Update is_admin_email function to use user_roles table instead of hardcoded email
-- This addresses the DEFINER_OR_RPC_BYPASS security issue

CREATE OR REPLACE FUNCTION public.is_admin_email(_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM auth.users u
    JOIN public.user_roles ur ON ur.user_id = u.id
    WHERE u.email = _email 
      AND ur.role = 'admin'
  )
  -- Also check super admin emails for backward compatibility
  OR _email IN (
    'prod.makemusic@gmail.com',
    'romain.scheyvaerts@gmail.com'
  )
$$;

-- Fix 2: Add policy to explicitly block anonymous access to bookings table
-- This addresses the MISSING_RLS / PUBLIC_DATA_EXPOSURE issue

-- First drop the overly permissive service role policy
DROP POLICY IF EXISTS "Service role can manage bookings" ON public.bookings;

-- Create a proper policy that only works for service_role 
-- Note: service_role bypasses RLS by default, so we create a permissive policy for authenticated service role usage
-- The key fix is ensuring anon users cannot access the table

-- Add policy to explicitly deny anonymous access
CREATE POLICY "Block anonymous access"
ON public.bookings
FOR ALL
TO anon
USING (false)
WITH CHECK (false);-- Add superadmin to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'superadmin';-- Create a function to check if user is superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'superadmin'
  )
$$;-- Create table to track promo code usage per user
CREATE TABLE public.promo_code_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for efficient lookups
CREATE INDEX idx_promo_code_usage_code_email ON public.promo_code_usage(promo_code_id, user_email);
CREATE INDEX idx_promo_code_usage_email ON public.promo_code_usage(user_email);

-- Add usage limit column to promo_codes table
ALTER TABLE public.promo_codes 
ADD COLUMN max_uses_per_user INTEGER DEFAULT NULL;

-- Enable RLS
ALTER TABLE public.promo_code_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Allow admins to manage promo code usage
CREATE POLICY "Admins can manage promo code usage"
ON public.promo_code_usage
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')
  )
);

-- Policy: Allow service role to insert usage (from edge functions)
CREATE POLICY "Service role can insert usage"
ON public.promo_code_usage
FOR INSERT
WITH CHECK (true);