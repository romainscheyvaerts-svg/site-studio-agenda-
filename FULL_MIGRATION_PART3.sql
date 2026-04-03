-- =============================================================================
-- MAKE MUSIC STUDIO - MIGRATION COMPLÈTE - PARTIE 3/3
-- Email config, templates, admin profiles, sessions, storage buckets
-- Copier-coller dans Supabase SQL Editor > New Query > Run
-- =============================================================================

-- =============================================================================
-- EMAIL CONFIG
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.email_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_color VARCHAR(7) DEFAULT '#22d3ee',
    secondary_color VARCHAR(7) DEFAULT '#7c3aed',
    background_color VARCHAR(7) DEFAULT '#0a0a0a',
    card_color VARCHAR(7) DEFAULT '#1a1a1a',
    text_color VARCHAR(7) DEFAULT '#ffffff',
    muted_text_color VARCHAR(7) DEFAULT '#a1a1aa',
    border_color VARCHAR(7) DEFAULT '#262626',
    success_color VARCHAR(7) DEFAULT '#10b981',
    logo_url TEXT DEFAULT 'https://www.studiomakemusic.com/favicon.png',
    studio_name VARCHAR(255) DEFAULT 'Make Music Studio',
    footer_text TEXT DEFAULT 'Make Music Studio - Studio d''enregistrement professionnel à Bruxelles',
    footer_address TEXT DEFAULT 'Rue de la Loi 42, 1000 Bruxelles',
    footer_phone VARCHAR(50) DEFAULT '+32 456 123 789',
    footer_email VARCHAR(255) DEFAULT 'prod.makemusic@gmail.com',
    social_instagram VARCHAR(255) DEFAULT 'https://instagram.com/makemusic.studio',
    social_facebook VARCHAR(255) DEFAULT '',
    social_youtube VARCHAR(255) DEFAULT '',
    social_tiktok VARCHAR(255) DEFAULT '',
    show_calendar_button BOOLEAN DEFAULT true,
    show_social_links BOOLEAN DEFAULT true,
    show_logo BOOLEAN DEFAULT true,
    font_family VARCHAR(100) DEFAULT 'Arial, Helvetica, sans-serif',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

INSERT INTO public.email_config (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.email_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_config_public_read" ON public.email_config
    FOR SELECT USING (true);

CREATE POLICY "email_config_admin_update" ON public.email_config
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

CREATE OR REPLACE FUNCTION update_email_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_config_updated_at_trigger ON public.email_config;
CREATE TRIGGER email_config_updated_at_trigger
    BEFORE UPDATE ON public.email_config
    FOR EACH ROW EXECUTE FUNCTION update_email_config_updated_at();

-- =============================================================================
-- EMAIL TEMPLATES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key VARCHAR(50) UNIQUE NOT NULL,
    template_name VARCHAR(100) NOT NULL,
    template_description TEXT,
    subject_template TEXT NOT NULL,
    heading_text TEXT,
    subheading_text TEXT,
    body_template TEXT,
    cta_button_text VARCHAR(100),
    cta_button_url_template TEXT,
    footer_text TEXT,
    show_logo BOOLEAN DEFAULT true,
    show_session_details BOOLEAN DEFAULT true,
    show_price BOOLEAN DEFAULT true,
    show_calendar_button BOOLEAN DEFAULT true,
    show_drive_link BOOLEAN DEFAULT true,
    show_social_links BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

INSERT INTO public.email_templates (template_key, template_name, template_description, subject_template, heading_text, subheading_text, body_template, cta_button_text, show_session_details, show_price, show_calendar_button, show_drive_link) VALUES
('booking_confirmed', 'Réservation Confirmée', 'Email envoyé au client quand l''admin confirme sa réservation',
 '✓ Session confirmée - {{session_date}}',
 '🎉 Votre session est confirmée !',
 'Nous avons hâte de vous accueillir au studio.',
 'Bonjour {{client_name}},

Votre session d''enregistrement du {{session_date}} de {{start_time}} à {{end_time}} est confirmée.

{{#if drive_link}}
📁 Votre dossier Google Drive personnel a été créé pour cette session.
{{/if}}

À très bientôt au studio !',
 'Ajouter à mon agenda', true, true, true, true),

('booking_rejected', 'Réservation Refusée', 'Email envoyé au client quand sa réservation est refusée',
 'Information sur votre réservation - {{session_date}}',
 'Session non disponible',
 'Nous sommes désolés.',
 'Bonjour {{client_name}},

Malheureusement, le créneau que vous avez réservé pour le {{session_date}} ({{start_time}} - {{end_time}}) n''est plus disponible.

💰 Un remboursement complet de {{amount_paid}}€ sera effectué sous 5-10 jours ouvrables.

Nous vous invitons à effectuer une nouvelle réservation sur notre site.',
 'Réserver un autre créneau', true, true, false, false),

('booking_pending', 'Réservation En Attente', 'Email envoyé quand la réservation nécessite confirmation',
 '⏳ Votre réservation est en attente de confirmation - {{session_date}}',
 '⏳ Réservation en cours de traitement',
 'Votre demande a bien été reçue.',
 'Bonjour {{client_name}},

Votre demande de session du {{session_date}} de {{start_time}} à {{end_time}} est bien enregistrée.

⚠️ Cette réservation est en attente de confirmation car elle est prévue dans moins de 24 heures.

Vous recevrez un email de confirmation dès que nous aurons vérifié la disponibilité.',
 NULL, true, true, false, false),

('booking_immediate', 'Confirmation Immédiate', 'Email de confirmation immédiate après paiement',
 '✅ Confirmation de réservation - Make Music Studio - {{session_date}}',
 '🎉 Réservation Confirmée !',
 'Merci pour votre réservation.',
 'Bonjour {{client_name}},

Votre session d''enregistrement est confirmée !

📅 Date: {{session_date}}
🕐 Horaire: {{start_time}} - {{end_time}}
🎤 Service: {{service_type}}
💰 Montant payé: {{amount_paid}}€

À très bientôt au studio !',
 'Ajouter à mon agenda', true, true, true, true),

('admin_session_email', 'Email Admin vers Client', 'Email personnalisé envoyé par l''admin',
 '🎵 Make Music - {{service_type}}',
 'Information de session', NULL,
 '{{custom_message}}',
 'Payer maintenant', true, true, true, true),

('admin_notification', 'Notification Admin', 'Email reçu par l''admin quand un client réserve',
 '🎵 Nouvelle réservation - {{client_name}} - {{service_type}}',
 'Nouvelle réservation !', NULL,
 'Un nouveau client a effectué une réservation.

👤 Client: {{client_name}}
📧 Email: {{client_email}}
📞 Téléphone: {{client_phone}}

📅 Date: {{session_date}}
🕐 Horaire: {{start_time}} - {{end_time}}
🎤 Service: {{service_type}}
💰 Montant payé: {{amount_paid}}€',
 'Voir dans l''agenda', true, true, false, true),

('admin_action_required', 'Action Requise', 'Email demandant à l''admin de confirmer ou refuser',
 '⚠️ Action requise - Réservation {{client_name}} - {{session_date}}',
 '⚠️ Confirmation requise',
 'Une réservation nécessite votre attention.',
 'Un client a réservé un créneau dans moins de 24 heures.

👤 Client: {{client_name}}
📧 Email: {{client_email}}

📅 Date: {{session_date}}
🕐 Horaire: {{start_time}} - {{end_time}}
🎤 Service: {{service_type}}
💰 Montant payé: {{amount_paid}}€

Veuillez confirmer ou refuser cette réservation.',
 'Confirmer / Refuser', true, true, false, false),

('payment_confirmation', 'Confirmation Paiement', 'Email de confirmation après paiement réussi',
 '✅ Paiement reçu - Make Music Studio',
 '💳 Paiement confirmé !',
 'Merci pour votre paiement.',
 'Bonjour {{client_name}},

Nous avons bien reçu votre paiement de {{amount_paid}}€.

📅 Date de session: {{session_date}}
🕐 Horaire: {{start_time}} - {{end_time}}',
 NULL, true, true, false, false),

('quote_request', 'Demande de Devis (Studio)', 'Email reçu par le studio pour un devis',
 '📋 Nouvelle demande de devis - {{client_name}}',
 'Nouvelle demande de devis', NULL,
 'Une nouvelle demande de devis a été reçue.

👤 Nom: {{client_name}}
📧 Email: {{client_email}}
📞 Téléphone: {{client_phone}}

💬 Projet:
{{message}}',
 'Répondre', false, false, false, false),

('quote_confirmation', 'Confirmation Demande Devis', 'Email de confirmation au client après demande devis',
 'Votre demande de devis - Make Music Studio',
 '📋 Demande de devis reçue',
 'Merci de votre intérêt !',
 'Bonjour {{client_name}},

Nous avons bien reçu votre demande de devis.

Notre équipe l''examinera et vous répondra dans les 24-48 heures.',
 'Visiter notre site', true, false, false, false),

('invoice', 'Facture', 'Email contenant la facture',
 'Facture {{invoice_number}} - Make Music Studio',
 '📄 Votre facture', NULL,
 'Bonjour {{client_name}},

Veuillez trouver ci-joint votre facture n°{{invoice_number}}.

Montant: {{total_amount}}€

Merci pour votre confiance !',
 'Télécharger la facture', true, true, false, false),

('instrumental_delivery', 'Livraison Instrumental', 'Email de livraison après achat instrumental',
 '🎵 Votre Instrumental "{{instrumental_title}}" est prêt !',
 '🎵 Votre instrumental est prêt !',
 'Merci pour votre achat.',
 'Bonjour,

Votre instrumental "{{instrumental_title}}" est maintenant disponible au téléchargement.

🎹 BPM: {{bpm}}
🎼 Tonalité: {{key}}
📜 Licence: {{license_type}}

⚠️ Ce lien expire dans 7 jours.',
 'Télécharger maintenant', true, true, false, false)

ON CONFLICT (template_key) DO NOTHING;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_templates_public_read" ON public.email_templates
    FOR SELECT USING (true);

CREATE POLICY "email_templates_admin_update" ON public.email_templates
    FOR UPDATE USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')));

CREATE POLICY "email_templates_admin_insert" ON public.email_templates
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')));

CREATE OR REPLACE FUNCTION update_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_templates_updated_at_trigger ON public.email_templates;
CREATE TRIGGER email_templates_updated_at_trigger
    BEFORE UPDATE ON public.email_templates
    FOR EACH ROW EXECUTE FUNCTION update_email_templates_updated_at();

-- =============================================================================
-- CLIENT SESSIONS (COMPTABILITÉ)
-- =============================================================================
CREATE TABLE IF NOT EXISTS client_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email TEXT NOT NULL,
  client_name TEXT,
  session_date DATE NOT NULL,
  session_type TEXT NOT NULL,
  duration_hours NUMERIC(4,1) NOT NULL DEFAULT 1,
  base_price NUMERIC(10,2) NOT NULL,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  final_price NUMERIC(10,2) NOT NULL,
  payment_method TEXT DEFAULT 'online',
  payment_status TEXT DEFAULT 'paid',
  notes TEXT,
  google_event_id TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_sessions_email ON client_sessions(client_email);
CREATE INDEX IF NOT EXISTS idx_client_sessions_date ON client_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_client_sessions_type ON client_sessions(session_type);
ALTER TABLE client_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view their own sessions" ON client_sessions
  FOR SELECT USING (auth.email() = client_email);

CREATE POLICY "Admins can manage all sessions" ON client_sessions
  FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')));

CREATE OR REPLACE FUNCTION update_client_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_client_sessions_updated_at
  BEFORE UPDATE ON client_sessions
  FOR EACH ROW EXECUTE FUNCTION update_client_sessions_updated_at();

CREATE OR REPLACE VIEW client_stats AS
SELECT
  client_email,
  MAX(client_name) as client_name,
  COUNT(*) as total_sessions,
  SUM(duration_hours) as total_hours,
  SUM(base_price) as total_base_price,
  SUM(discount_amount) as total_discounts,
  SUM(final_price) as total_spent,
  MIN(session_date) as first_session,
  MAX(session_date) as last_session
FROM client_sessions
GROUP BY client_email;

GRANT SELECT ON client_stats TO authenticated;

-- =============================================================================
-- ADMIN PROFILES
-- =============================================================================
CREATE TABLE IF NOT EXISTS admin_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#00D9FF',
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS session_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignment_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_profiles_user_id ON admin_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_session_assignments_event_id ON session_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_session_assignments_created_by ON session_assignments(created_by);
CREATE INDEX IF NOT EXISTS idx_session_assignments_assigned_to ON session_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_session_assignments_token ON session_assignments(assignment_token);

ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all profiles" ON admin_profiles
  FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')));

CREATE POLICY "Users can update their own profile" ON admin_profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON admin_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all assignments" ON session_assignments
  FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')));

CREATE POLICY "Admins can insert assignments" ON session_assignments
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')));

CREATE POLICY "Admins can update assignments" ON session_assignments
  FOR UPDATE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')));

CREATE POLICY "Anyone can view by token" ON session_assignments
  FOR SELECT USING (true);

-- Admin session assignment email template
INSERT INTO public.email_templates (
  template_key, template_name, template_description, subject_template, heading_text, subheading_text, body_template, cta_button_text, cta_button_url_template,
  show_logo, show_session_details, show_price, show_calendar_button, show_drive_link, show_social_links
) VALUES (
  'admin_session_assignment', 'Notification Session Admin', 'Email envoyé à l''admin assigné',
  '📅 Nouvelle session assignée - {{session_date}} à {{start_time}}',
  '🎤 Nouvelle session à gérer !',
  'Vous avez été assigné(e) à une session d''enregistrement.',
  'Bonjour {{admin_name}},

Une nouvelle session vous a été assignée :

📅 Date: {{session_date}}
🕐 Horaire: {{start_time}} - {{end_time}}
⏱️ Durée: {{duration}}h
🎤 Session: {{session_title}}

Cliquez sur le bouton ci-dessous pour ajouter cet événement à votre agenda personnel.',
  'Ajouter à mon agenda', '{{calendar_add_url}}',
  true, true, false, true, false, false
) ON CONFLICT (template_key) DO NOTHING;

-- =============================================================================
-- STORAGE BUCKETS
-- =============================================================================

-- Gallery bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('gallery', 'gallery', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Gallery images are publicly accessible"
ON storage.objects FOR SELECT USING (bucket_id = 'gallery');

CREATE POLICY "Admins can upload gallery images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'gallery' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin')
);

CREATE POLICY "Admins can delete gallery images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'gallery' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin')
);

-- Instrumental covers bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'instrumental-covers', 'instrumental-covers', true,
  5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true, file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

CREATE POLICY "Admins can upload covers"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'instrumental-covers');

CREATE POLICY "Public can view covers"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'instrumental-covers');

CREATE POLICY "Admins can update covers"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'instrumental-covers')
WITH CHECK (bucket_id = 'instrumental-covers');

CREATE POLICY "Admins can delete covers"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'instrumental-covers');

-- =============================================================================
-- FIN PARTIE 3 ✅ - MIGRATION TERMINÉE !
-- =============================================================================
-- 
-- N'oubliez pas de :
-- 1. Créer un compte utilisateur (via Auth dans le Dashboard)
-- 2. Puis exécuter cette requête pour le rendre admin :
--
--    SELECT id, email FROM auth.users WHERE email = 'VOTRE_EMAIL@gmail.com';
--    INSERT INTO public.user_roles (user_id, role) VALUES ('USER_ID_ICI', 'admin');
--
-- 3. Configurer les secrets Edge Functions dans Dashboard > Settings > Edge Functions
-- =============================================================================
