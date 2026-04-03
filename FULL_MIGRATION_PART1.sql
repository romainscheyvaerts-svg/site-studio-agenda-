-- =============================================================================
-- MAKE MUSIC STUDIO - MIGRATION COMPLÈTE - PARTIE 1/3
-- Base: Tables principales, fonctions, RLS
-- Copier-coller dans Supabase SQL Editor > New Query > Run
-- =============================================================================

-- =============================================================================
-- 0. CLEANUP (safe for fresh database)
-- =============================================================================
DO $$ BEGIN
  -- Drop policies only if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') THEN
    DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.is_superadmin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_email(text) CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

DROP TABLE IF EXISTS public.user_roles CASCADE;

DO $$ BEGIN
  DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DROP TYPE IF EXISTS public.app_role CASCADE;

-- =============================================================================
-- 1. ENUMS
-- =============================================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'superadmin');

-- =============================================================================
-- 2. USER_ROLES TABLE
-- =============================================================================
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 3. UTILITY FUNCTIONS
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_email(_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN public.user_roles ur ON ur.user_id = u.id
    WHERE u.email = _email AND ur.role = 'admin'
  )
  OR _email IN (
    'prod.makemusic@gmail.com',
    'romain.scheyvaerts@gmail.com'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'superadmin'
  )
$$;

-- =============================================================================
-- 4. RLS POLICIES FOR USER_ROLES
-- =============================================================================
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================================================
-- CLIENT DRIVE FOLDERS
-- =============================================================================
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
ALTER TABLE public.client_drive_folders ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_client_drive_folders_email ON public.client_drive_folders(client_email);
CREATE INDEX idx_client_drive_folders_phone ON public.client_drive_folders(client_phone);

CREATE POLICY "Users can view their own drive folders"
ON public.client_drive_folders FOR SELECT TO authenticated
USING (client_email = auth.jwt() ->> 'email');

CREATE POLICY "Deny anonymous access"
ON public.client_drive_folders FOR SELECT TO anon
USING (false);

CREATE TRIGGER update_client_drive_folders_updated_at
BEFORE UPDATE ON public.client_drive_folders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- PROMO CODES
-- =============================================================================
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
    custom_price_with_engineer NUMERIC DEFAULT NULL,
    custom_price_without_engineer NUMERIC DEFAULT NULL,
    require_full_payment BOOLEAN DEFAULT false,
    max_uses_per_user INTEGER DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read promo codes"
ON public.promo_codes FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert promo codes"
ON public.promo_codes FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update promo codes"
ON public.promo_codes FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete promo codes"
ON public.promo_codes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_promo_codes_updated_at
BEFORE UPDATE ON public.promo_codes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.promo_codes (code, is_active, full_calendar_visibility, skip_payment, skip_identity_verification, skip_form_fields, discount_recording, discount_rental, discount_mixing, discount_mastering) VALUES
('vip777', true, true, true, true, false, 0, 0, 0, 0),
('gold50', true, false, false, false, false, 40, 15, 50, 50),
('vip50', true, false, false, true, false, 40, 15, 50, 50),
('cashonly777', true, false, true, false, false, 0, 0, 0, 0);

-- =============================================================================
-- PROMO CODE USAGE
-- =============================================================================
CREATE TABLE public.promo_code_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_promo_code_usage_code_email ON public.promo_code_usage(promo_code_id, user_email);
CREATE INDEX idx_promo_code_usage_email ON public.promo_code_usage(user_email);
ALTER TABLE public.promo_code_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage promo code usage"
ON public.promo_code_usage FOR ALL
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')));

CREATE POLICY "Service role can insert usage"
ON public.promo_code_usage FOR INSERT WITH CHECK (true);

-- =============================================================================
-- INSTRUMENTALS
-- =============================================================================
CREATE TABLE public.instrumentals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  genre TEXT,
  bpm INTEGER,
  key TEXT,
  preview_url TEXT,
  cover_image_url TEXT,
  drive_file_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  price_base NUMERIC DEFAULT 100,
  price_stems NUMERIC DEFAULT 150,
  price_exclusive NUMERIC DEFAULT 500,
  has_stems BOOLEAN DEFAULT false,
  stems_folder_id TEXT,
  stems_drive_url TEXT,
  sort_order INTEGER DEFAULT 0,
  collab_artist_name TEXT,
  collab_artist_username TEXT,
  collab_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.instrumentals ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_instrumentals_sort_order ON public.instrumentals(sort_order);
CREATE INDEX IF NOT EXISTS idx_instrumentals_collab_username ON public.instrumentals(collab_artist_username) WHERE collab_artist_username IS NOT NULL;

CREATE POLICY "Anyone can view active instrumentals"
ON public.instrumentals FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage instrumentals"
ON public.instrumentals FOR ALL USING (public.is_admin_email(auth.jwt()->>'email'));

CREATE POLICY "Anyone can update collab_visible"
ON public.instrumentals FOR UPDATE USING (true) WITH CHECK (true);

CREATE TRIGGER update_instrumentals_updated_at
BEFORE UPDATE ON public.instrumentals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- INSTRUMENTAL LICENSES
-- =============================================================================
CREATE TABLE public.instrumental_licenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  features TEXT[],
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.instrumental_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active licenses"
ON public.instrumental_licenses FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage licenses"
ON public.instrumental_licenses FOR ALL USING (public.is_admin_email(auth.jwt()->>'email'));

INSERT INTO public.instrumental_licenses (name, description, price, features, sort_order) VALUES
('Basic', 'Licence de base pour usage non-commercial', 29.00, ARRAY['MP3 + WAV haute qualité', 'Usage streaming (Spotify, Apple Music)', 'Jusqu''à 10 000 streams', 'Crédit obligatoire'], 1),
('Premium', 'Licence complète pour artistes', 79.00, ARRAY['MP3 + WAV + Stems', 'Usage streaming illimité', 'Usage vidéo (YouTube, TikTok)', 'Distribution digitale', 'Crédit recommandé'], 2),
('Exclusive', 'Licence exclusive - vous êtes le seul propriétaire', 299.00, ARRAY['Tous les fichiers sources', 'Droits exclusifs complets', 'Retrait de la vente', 'Usage commercial illimité', 'Aucun crédit requis'], 3);

-- =============================================================================
-- INSTRUMENTAL PURCHASES
-- =============================================================================
CREATE TABLE public.instrumental_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  instrumental_id UUID NOT NULL REFERENCES public.instrumentals(id),
  license_id UUID NOT NULL REFERENCES public.instrumental_licenses(id),
  payment_id TEXT,
  payment_method TEXT,
  amount_paid DECIMAL(10,2) NOT NULL,
  download_token TEXT NOT NULL UNIQUE,
  download_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  buyer_email TEXT NOT NULL,
  buyer_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.instrumental_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own purchases"
ON public.instrumental_purchases FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert purchases"
ON public.instrumental_purchases FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all purchases"
ON public.instrumental_purchases FOR SELECT USING (public.is_admin_email(auth.jwt()->>'email'));

-- =============================================================================
-- SERVICES
-- =============================================================================
CREATE TABLE public.services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_key text NOT NULL UNIQUE,
  name_fr text NOT NULL,
  base_price numeric NOT NULL,
  price_unit text NOT NULL DEFAULT 'fixed',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view services" ON public.services FOR SELECT USING (true);
CREATE POLICY "Admins can manage services" ON public.services FOR ALL USING (is_admin_email((auth.jwt() ->> 'email'::text)));

INSERT INTO public.services (service_key, name_fr, base_price, price_unit, sort_order) VALUES
  ('with-engineer', 'Session avec Ingénieur Son', 45, 'hourly', 1),
  ('without-engineer', 'Location Dry (sans ingénieur)', 22, 'hourly', 2),
  ('mixing', 'Mixage', 200, 'fixed', 3),
  ('mastering', 'Mastering Numérique', 60, 'fixed', 4),
  ('analog-mastering', 'Mastering Analogique', 100, 'fixed', 5),
  ('podcast', 'Mixage Podcast', 40, 'per_minute', 6),
  ('composition', 'Composition', 200, 'fixed', 7);

CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- SALES CONFIG
-- =============================================================================
CREATE TABLE public.sales_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_active boolean NOT NULL DEFAULT false,
  sale_name text NOT NULL DEFAULT 'Promotion',
  discount_percentage numeric NOT NULL DEFAULT 0,
  discount_with_engineer numeric DEFAULT 0,
  discount_without_engineer numeric DEFAULT 0,
  discount_mixing numeric DEFAULT 0,
  discount_mastering numeric DEFAULT 0,
  discount_analog_mastering numeric DEFAULT 0,
  discount_podcast numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sales config" ON public.sales_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage sales config" ON public.sales_config FOR ALL USING (is_admin_email((auth.jwt() ->> 'email'::text)));

INSERT INTO public.sales_config (is_active, sale_name, discount_percentage) VALUES (false, 'Promotion', 0);

CREATE TRIGGER update_sales_config_updated_at
BEFORE UPDATE ON public.sales_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- SERVICE FEATURES
-- =============================================================================
CREATE TABLE public.service_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_key TEXT NOT NULL,
  feature_text TEXT NOT NULL,
  feature_text_en TEXT,
  feature_text_nl TEXT,
  feature_text_es TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.service_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active service features"
ON public.service_features FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage service features"
ON public.service_features FOR ALL USING (is_admin_email((auth.jwt() ->> 'email'::text)));

CREATE TRIGGER update_service_features_updated_at
BEFORE UPDATE ON public.service_features
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.service_features (service_key, feature_text, sort_order) VALUES
('with-engineer', 'Ingénieur son dédié', 1),
('with-engineer', 'Mix en temps réel', 2),
('with-engineer', 'Conseils artistiques', 3),
('with-engineer', 'Export multipistes', 4),
('without-engineer', 'Studio en autonomie', 1),
('without-engineer', 'Équipement inclus', 2),
('without-engineer', 'Accès 24/7 possible', 3),
('without-engineer', 'Support technique', 4),
('mixing', 'Mix professionnel', 1),
('mixing', 'Mastering inclus (60€)', 2),
('mixing', 'Révisions incluses', 3),
('mixing', 'Plugins premium', 4),
('mixing', 'Lien Drive envoyé par mail', 5),
('mastering', 'Traitement numérique', 1),
('mastering', 'Loudness optimisé', 2),
('mastering', 'Format streaming', 3),
('mastering', 'Fichier WAV + MP3', 4),
('analog-mastering', 'Console SSL', 1),
('analog-mastering', 'Couleur analogique', 2),
('analog-mastering', 'Loudness optimisé', 3),
('analog-mastering', 'Session d''écoute studio', 4),
('podcast', 'Nettoyage audio', 1),
('podcast', 'Égalisation voix', 2),
('podcast', 'Montage si nécessaire', 3),
('podcast', 'Export optimisé podcast', 4);

-- =============================================================================
-- FIN PARTIE 1 ✅
-- =============================================================================
