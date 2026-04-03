-- =============================================================================
-- MAKE MUSIC STUDIO - MIGRATION COMPLÈTE - PARTIE 2/3
-- Tables restantes: bookings, gallery, security, chatbot, config
-- Copier-coller dans Supabase SQL Editor > New Query > Run
-- =============================================================================

-- =============================================================================
-- BLOCKED USERS
-- =============================================================================
CREATE TABLE public.blocked_users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  blocked_at timestamp with time zone NOT NULL DEFAULT now(),
  blocked_by text NOT NULL,
  reason text
);
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage blocked users"
ON public.blocked_users FOR ALL
USING (is_admin_email((auth.jwt() ->> 'email'::text)));

-- =============================================================================
-- BLOCKED IPS
-- =============================================================================
CREATE TABLE public.blocked_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL UNIQUE,
  reason text,
  blocked_by text NOT NULL,
  blocked_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_blocked_ips_ip ON public.blocked_ips(ip_address);

CREATE POLICY "Admins can manage blocked IPs" ON public.blocked_ips
  FOR ALL USING (is_admin_email((auth.jwt() ->> 'email'::text)));

-- =============================================================================
-- ACTIVITY LOGS
-- =============================================================================
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
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_activity_logs_ip ON public.activity_logs(ip_address);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

CREATE POLICY "Admins can view activity logs" ON public.activity_logs
  FOR SELECT USING (is_admin_email((auth.jwt() ->> 'email'::text)));

CREATE POLICY "Service role can insert activity logs" ON public.activity_logs
  FOR INSERT WITH CHECK (true);

-- =============================================================================
-- CHATBOT CONFIG
-- =============================================================================
CREATE TABLE public.chatbot_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  system_prompt text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.chatbot_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read chatbot config"
ON public.chatbot_config FOR SELECT USING (true);

CREATE POLICY "Admins can manage chatbot config"
ON public.chatbot_config FOR ALL
USING (is_admin_email((auth.jwt() ->> 'email'::text)));

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

Sois professionnel, chaleureux et expert. Tu représentes un studio haut de gamme.');

-- =============================================================================
-- BOOKINGS
-- =============================================================================
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
CREATE INDEX idx_bookings_date ON public.bookings(session_date);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_validation_token ON public.bookings(validation_token);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all bookings"
ON public.bookings FOR ALL
USING (is_admin_email((auth.jwt() ->> 'email'::text)));

CREATE POLICY "Users can view their own bookings"
ON public.bookings FOR SELECT
USING (client_email = (auth.jwt() ->> 'email'::text));

CREATE POLICY "Block anonymous access"
ON public.bookings FOR ALL TO anon
USING (false) WITH CHECK (false);

CREATE TRIGGER update_bookings_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- GALLERY PHOTOS
-- =============================================================================
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
ALTER TABLE public.gallery_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active gallery photos"
ON public.gallery_photos FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage gallery photos"
ON public.gallery_photos FOR ALL
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

CREATE TRIGGER update_gallery_photos_updated_at
BEFORE UPDATE ON public.gallery_photos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- SITE CONFIG
-- =============================================================================
CREATE TABLE public.site_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site config" ON public.site_config FOR SELECT USING (true);

CREATE POLICY "Admins can update site config" ON public.site_config FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert site config" ON public.site_config FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE TRIGGER update_site_config_updated_at
BEFORE UPDATE ON public.site_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.site_config (config_key, config_value, description)
VALUES ('daw_url', 'https://glowing-space-umbrella-v69756456w74hwvpv-3000.app.github.dev/', 'URL du DAW Nova Studio externe');

-- =============================================================================
-- PRICING CONTENT
-- =============================================================================
CREATE TABLE public.pricing_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_key TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text',
  content_fr TEXT NOT NULL DEFAULT '',
  content_en TEXT NOT NULL DEFAULT '',
  content_nl TEXT NOT NULL DEFAULT '',
  content_es TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.pricing_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pricing content" ON public.pricing_content FOR SELECT USING (true);
CREATE POLICY "Admins can manage pricing content" ON public.pricing_content FOR ALL USING (is_admin_email((auth.jwt() ->> 'email'::text)));

-- =============================================================================
-- PENDING FREE BOOKINGS
-- =============================================================================
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
CREATE INDEX IF NOT EXISTS idx_pending_free_bookings_status ON public.pending_free_bookings(status);
CREATE INDEX IF NOT EXISTS idx_pending_free_bookings_token ON public.pending_free_bookings(approval_token);
ALTER TABLE public.pending_free_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view pending bookings" ON public.pending_free_bookings
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')));

CREATE POLICY "Service role full access pending" ON public.pending_free_bookings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON public.pending_free_bookings TO service_role;
GRANT SELECT ON public.pending_free_bookings TO authenticated;

-- =============================================================================
-- TRUSTED USERS
-- =============================================================================
CREATE TABLE IF NOT EXISTS trusted_users (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL UNIQUE,
    trusted_by uuid,
    reason text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE trusted_users ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_trusted_users_user_id ON trusted_users(user_id);

CREATE POLICY "Admins can read trusted_users" ON trusted_users
    FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'superadmin')));

CREATE POLICY "Admins can insert trusted_users" ON trusted_users
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'superadmin')));

CREATE POLICY "Admins can delete trusted_users" ON trusted_users
    FOR DELETE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'superadmin')));

CREATE POLICY "Users can check own trusted status" ON trusted_users
    FOR SELECT USING (user_id = auth.uid());

-- =============================================================================
-- SOCIAL LINKS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.social_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  url text NOT NULL,
  display_name text,
  icon_name text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_social_links_sort ON social_links(sort_order);
ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Social links are viewable by everyone"
  ON public.social_links FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage social links"
  ON public.social_links FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')));

CREATE OR REPLACE FUNCTION update_social_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS social_links_updated_at ON social_links;
CREATE TRIGGER social_links_updated_at
  BEFORE UPDATE ON social_links
  FOR EACH ROW EXECUTE FUNCTION update_social_links_updated_at();

INSERT INTO public.social_links (platform, url, display_name, icon_name, sort_order)
SELECT * FROM (VALUES
  ('instagram', 'https://instagram.com/makemusicstudio', '@makemusicstudio', 'Instagram', 1),
  ('tiktok', 'https://tiktok.com/@makemusicstudio', '@makemusicstudio', 'Music2', 2),
  ('youtube', 'https://youtube.com/@makemusicstudio', 'Make Music Studio', 'Youtube', 3)
) AS v(platform, url, display_name, icon_name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.social_links);

-- =============================================================================
-- FIN PARTIE 2 ✅
-- =============================================================================
