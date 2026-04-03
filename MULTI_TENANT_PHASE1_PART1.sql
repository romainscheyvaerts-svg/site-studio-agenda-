-- =============================================================================
-- PHASE 1 - MULTI-TENANT - PARTIE 1/2
-- Création des tables studios + studio_members + fonction helper
-- + Ajout studio_id à toutes les tables existantes
-- =============================================================================

-- =============================================================================
-- 1. TABLE STUDIOS (cœur du multi-tenant)
-- =============================================================================
CREATE TABLE public.studios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identité
  slug TEXT NOT NULL UNIQUE,  -- URL: /mon-studio
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  
  -- Branding
  primary_color TEXT DEFAULT '#22d3ee',
  secondary_color TEXT DEFAULT '#7c3aed',
  background_color TEXT DEFAULT '#0a0a0a',
  
  -- Adresse
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'BE',
  phone TEXT,
  email TEXT,
  
  -- API Keys (chaque studio a les siennes)
  stripe_publishable_key TEXT,
  stripe_secret_key TEXT,
  paypal_client_id TEXT,
  paypal_client_secret TEXT,
  google_calendar_id TEXT,
  google_patron_calendar_id TEXT,
  google_drive_parent_folder_id TEXT,
  google_service_account_key TEXT,  -- JSON
  resend_api_key TEXT,
  resend_from_email TEXT,
  gemini_api_key TEXT,
  
  -- Abonnement plateforme (5€/mois)
  subscription_status TEXT NOT NULL DEFAULT 'trialing' CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  stripe_customer_id TEXT,        -- ID client Stripe (ton compte Stripe)
  stripe_subscription_id TEXT,    -- ID abonnement Stripe
  trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '14 days'),
  
  -- État
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_studios_slug ON public.studios(slug);
CREATE INDEX idx_studios_subscription ON public.studios(subscription_status);

ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. TABLE STUDIO_MEMBERS (lie users ↔ studios)
-- =============================================================================
CREATE TYPE public.studio_role AS ENUM ('owner', 'admin', 'engineer');

CREATE TABLE public.studio_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role studio_role NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(studio_id, user_id)
);

CREATE INDEX idx_studio_members_user ON public.studio_members(user_id);
CREATE INDEX idx_studio_members_studio ON public.studio_members(studio_id);

ALTER TABLE public.studio_members ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 3. FONCTIONS HELPER MULTI-TENANT
-- =============================================================================

-- Retourne le studio_id de l'utilisateur connecté
CREATE OR REPLACE FUNCTION public.get_user_studio_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT studio_id 
  FROM public.studio_members 
  WHERE user_id = auth.uid() 
  LIMIT 1
$$;

-- Vérifie si l'utilisateur est membre d'un studio donné
CREATE OR REPLACE FUNCTION public.is_studio_member(_user_id UUID, _studio_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.studio_members
    WHERE user_id = _user_id AND studio_id = _studio_id
  )
$$;

-- Vérifie si l'utilisateur est owner/admin d'un studio
CREATE OR REPLACE FUNCTION public.is_studio_admin(_user_id UUID, _studio_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.studio_members
    WHERE user_id = _user_id 
    AND studio_id = _studio_id 
    AND role IN ('owner', 'admin')
  )
$$;

-- =============================================================================
-- 4. RLS POLICIES POUR STUDIOS ET STUDIO_MEMBERS
-- =============================================================================

-- Studios: les membres peuvent voir leur studio
CREATE POLICY "Members can view their studio" ON public.studios
  FOR SELECT TO authenticated
  USING (id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

-- Studios: le owner peut modifier son studio
CREATE POLICY "Owner can update studio" ON public.studios
  FOR UPDATE TO authenticated
  USING (id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid() AND role = 'owner'));

-- Studios: lecture publique pour les pages publiques (slug)
CREATE POLICY "Public can view active studios" ON public.studios
  FOR SELECT TO anon
  USING (is_active = true AND subscription_status IN ('active', 'trialing'));

-- Super admin peut tout voir
CREATE POLICY "Superadmin can manage all studios" ON public.studios
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()));

-- Studio members: les admins du studio peuvent gérer les membres
CREATE POLICY "Studio admins can view members" ON public.studio_members
  FOR SELECT TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

CREATE POLICY "Studio owner can manage members" ON public.studio_members
  FOR ALL TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid() AND role = 'owner'));

-- Superadmin
CREATE POLICY "Superadmin can manage all members" ON public.studio_members
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()));

-- =============================================================================
-- 5. AJOUTER studio_id À TOUTES LES TABLES EXISTANTES
-- =============================================================================

-- Bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_bookings_studio ON public.bookings(studio_id);

-- Services
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_services_studio ON public.services(studio_id);
ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_service_key_key;
ALTER TABLE public.services ADD CONSTRAINT services_studio_service_key_unique UNIQUE(studio_id, service_key);

-- Sales Config
ALTER TABLE public.sales_config ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_sales_config_studio ON public.sales_config(studio_id);

-- Service Features
ALTER TABLE public.service_features ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_service_features_studio ON public.service_features(studio_id);

-- Promo Codes
ALTER TABLE public.promo_codes ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_promo_codes_studio ON public.promo_codes(studio_id);

-- Promo Code Usage
ALTER TABLE public.promo_code_usage ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_promo_code_usage_studio ON public.promo_code_usage(studio_id);

-- Instrumentals
ALTER TABLE public.instrumentals ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_instrumentals_studio ON public.instrumentals(studio_id);

-- Instrumental Licenses
ALTER TABLE public.instrumental_licenses ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_instrumental_licenses_studio ON public.instrumental_licenses(studio_id);

-- Instrumental Purchases
ALTER TABLE public.instrumental_purchases ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_instrumental_purchases_studio ON public.instrumental_purchases(studio_id);

-- Gallery Photos
ALTER TABLE public.gallery_photos ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_gallery_photos_studio ON public.gallery_photos(studio_id);

-- Client Drive Folders
ALTER TABLE public.client_drive_folders ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_client_drive_folders_studio ON public.client_drive_folders(studio_id);

-- Blocked Users
ALTER TABLE public.blocked_users ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_blocked_users_studio ON public.blocked_users(studio_id);

-- Blocked IPs
ALTER TABLE public.blocked_ips ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_blocked_ips_studio ON public.blocked_ips(studio_id);

-- Activity Logs
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_activity_logs_studio ON public.activity_logs(studio_id);

-- Chatbot Config
ALTER TABLE public.chatbot_config ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_chatbot_config_studio ON public.chatbot_config(studio_id);

-- Site Config
ALTER TABLE public.site_config ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_site_config_studio ON public.site_config(studio_id);

-- Pricing Content
ALTER TABLE public.pricing_content ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_pricing_content_studio ON public.pricing_content(studio_id);

-- Email Config
ALTER TABLE public.email_config ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_email_config_studio ON public.email_config(studio_id);

-- Email Templates
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_email_templates_studio ON public.email_templates(studio_id);

-- Client Sessions
ALTER TABLE public.client_sessions ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_client_sessions_studio ON public.client_sessions(studio_id);

-- Admin Profiles
ALTER TABLE public.admin_profiles ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_admin_profiles_studio ON public.admin_profiles(studio_id);

-- Session Assignments
ALTER TABLE public.session_assignments ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_session_assignments_studio ON public.session_assignments(studio_id);

-- Trusted Users
ALTER TABLE public.trusted_users ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_trusted_users_studio ON public.trusted_users(studio_id);

-- Social Links
ALTER TABLE public.social_links ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_social_links_studio ON public.social_links(studio_id);

-- Pending Free Bookings
ALTER TABLE public.pending_free_bookings ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_pending_free_bookings_studio ON public.pending_free_bookings(studio_id);

-- Trigger updated_at pour studios
CREATE TRIGGER update_studios_updated_at
BEFORE UPDATE ON public.studios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- FIN PARTIE 1 ✅ — studio_id ajouté à toutes les tables
-- =============================================================================
