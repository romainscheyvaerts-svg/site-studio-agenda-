-- Migration: Email Templates Configuration
-- This table stores customizable email templates for each email type

-- First, let's keep the global email_config for colors and branding
-- Then add a new table for individual email templates

CREATE TABLE IF NOT EXISTS public.email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Template identifier
    template_key VARCHAR(50) UNIQUE NOT NULL,
    template_name VARCHAR(100) NOT NULL,
    template_description TEXT,

    -- Email content
    subject_template TEXT NOT NULL,
    heading_text TEXT,                    -- Main heading in email
    subheading_text TEXT,                 -- Subheading/intro text
    body_template TEXT,                   -- Main body content (supports placeholders)
    cta_button_text VARCHAR(100),         -- Call-to-action button text
    cta_button_url_template TEXT,         -- Button URL (supports placeholders)
    footer_text TEXT,                     -- Custom footer for this template

    -- Display options
    show_logo BOOLEAN DEFAULT true,
    show_session_details BOOLEAN DEFAULT true,
    show_price BOOLEAN DEFAULT true,
    show_calendar_button BOOLEAN DEFAULT true,
    show_drive_link BOOLEAN DEFAULT true,
    show_social_links BOOLEAN DEFAULT true,

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Insert default templates for each email type
INSERT INTO public.email_templates (template_key, template_name, template_description, subject_template, heading_text, subheading_text, body_template, cta_button_text, show_session_details, show_price, show_calendar_button, show_drive_link) VALUES

-- 1. Client: Booking Confirmed (after admin confirmation)
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
 'Ajouter à mon agenda',
 true, true, true, true),

-- 2. Client: Booking Rejected
('booking_rejected', 'Réservation Refusée', 'Email envoyé au client quand sa réservation est refusée (avec remboursement)',
 'Information sur votre réservation - {{session_date}}',
 'Session non disponible',
 'Nous sommes désolés.',
 'Bonjour {{client_name}},

Malheureusement, le créneau que vous avez réservé pour le {{session_date}} ({{start_time}} - {{end_time}}) n''est plus disponible.

💰 Un remboursement complet de {{amount_paid}}€ sera effectué sous 5-10 jours ouvrables.

Nous vous invitons à effectuer une nouvelle réservation sur notre site.

Nous nous excusons pour ce désagrément.',
 'Réserver un autre créneau',
 true, true, false, false),

-- 3. Client: Booking Pending Confirmation
('booking_pending', 'Réservation En Attente', 'Email envoyé quand la réservation nécessite confirmation (règle des 24h)',
 '⏳ Votre réservation est en attente de confirmation - {{session_date}}',
 '⏳ Réservation en cours de traitement',
 'Votre demande a bien été reçue.',
 'Bonjour {{client_name}},

Votre demande de session du {{session_date}} de {{start_time}} à {{end_time}} est bien enregistrée.

⚠️ Cette réservation est en attente de confirmation car elle est prévue dans moins de 24 heures.

Vous recevrez un email de confirmation dès que nous aurons vérifié la disponibilité du créneau.

Merci de votre patience !',
 NULL,
 true, true, false, false),

-- 4. Client: Immediate Booking Confirmation
('booking_immediate', 'Confirmation Immédiate', 'Email de confirmation immédiate après paiement (réservation > 24h)',
 '✅ Confirmation de réservation - Make Music Studio - {{session_date}}',
 '🎉 Réservation Confirmée !',
 'Merci pour votre réservation.',
 'Bonjour {{client_name}},

Votre session d''enregistrement est confirmée !

📅 Date: {{session_date}}
🕐 Horaire: {{start_time}} - {{end_time}}
🎤 Service: {{service_type}}
💰 Montant payé: {{amount_paid}}€

{{#if is_deposit}}
Le solde de {{remaining_amount}}€ sera à régler sur place.
{{/if}}

À très bientôt au studio !',
 'Ajouter à mon agenda',
 true, true, true, true),

-- 5. Admin: Session Email to Client
('admin_session_email', 'Email Admin vers Client', 'Email personnalisé envoyé par l''admin à un client',
 '🎵 Make Music - {{service_type}}',
 'Information de session',
 NULL,
 '{{custom_message}}',
 'Payer maintenant',
 true, true, true, true),

-- 6. Admin: Notification of New Booking
('admin_notification', 'Notification Admin', 'Email reçu par l''admin quand un client réserve',
 '🎵 Nouvelle réservation - {{client_name}} - {{service_type}}',
 'Nouvelle réservation !',
 NULL,
 'Un nouveau client a effectué une réservation.

👤 Client: {{client_name}}
📧 Email: {{client_email}}
📞 Téléphone: {{client_phone}}

📅 Date: {{session_date}}
🕐 Horaire: {{start_time}} - {{end_time}}
🎤 Service: {{service_type}}
💰 Montant payé: {{amount_paid}}€

{{#if message}}
💬 Message du client:
{{message}}
{{/if}}',
 'Voir dans l''agenda',
 true, true, false, true),

-- 7. Admin: Action Required (confirm/reject)
('admin_action_required', 'Action Requise', 'Email demandant à l''admin de confirmer ou refuser une réservation (<24h)',
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
 'Confirmer / Refuser',
 true, true, false, false),

-- 8. Client: Payment Confirmation
('payment_confirmation', 'Confirmation Paiement', 'Email de confirmation après paiement réussi',
 '✅ Paiement reçu - Make Music Studio',
 '💳 Paiement confirmé !',
 'Merci pour votre paiement.',
 'Bonjour {{client_name}},

Nous avons bien reçu votre paiement de {{amount_paid}}€.

📅 Date de session: {{session_date}}
🕐 Horaire: {{start_time}} - {{end_time}}

Votre confirmation de réservation vous sera envoyée séparément.',
 NULL,
 true, true, false, false),

-- 9. Studio: Quote Request
('quote_request', 'Demande de Devis (Studio)', 'Email reçu par le studio quand quelqu''un demande un devis',
 '📋 Nouvelle demande de devis - {{client_name}}',
 'Nouvelle demande de devis',
 NULL,
 'Une nouvelle demande de devis a été reçue.

👤 Nom: {{client_name}}
📧 Email: {{client_email}}
📞 Téléphone: {{client_phone}}

💬 Projet:
{{message}}',
 'Répondre',
 false, false, false, false),

-- 10. Client: Quote Request Confirmation
('quote_confirmation', 'Confirmation Demande Devis', 'Email de confirmation envoyé au client après sa demande de devis',
 'Votre demande de devis - Make Music Studio',
 '📋 Demande de devis reçue',
 'Merci de votre intérêt !',
 'Bonjour {{client_name}},

Nous avons bien reçu votre demande de devis.

Notre équipe l''examinera et vous répondra dans les 24-48 heures.

Pour toute question urgente, n''hésitez pas à nous contacter directement.',
 'Visiter notre site',
 true, false, false, false),

-- 11. Client: Invoice
('invoice', 'Facture', 'Email contenant la facture',
 'Facture {{invoice_number}} - Make Music Studio',
 '📄 Votre facture',
 NULL,
 'Bonjour {{client_name}},

Veuillez trouver ci-joint votre facture n°{{invoice_number}}.

Montant: {{total_amount}}€

Merci pour votre confiance !',
 'Télécharger la facture',
 true, true, false, false),

-- 12. Client: Instrumental Delivery
('instrumental_delivery', 'Livraison Instrumental', 'Email de livraison après achat d''un instrumental',
 '🎵 Votre Instrumental "{{instrumental_title}}" est prêt !',
 '🎵 Votre instrumental est prêt !',
 'Merci pour votre achat.',
 'Bonjour,

Votre instrumental "{{instrumental_title}}" est maintenant disponible au téléchargement.

🎹 BPM: {{bpm}}
🎼 Tonalité: {{key}}
📜 Licence: {{license_type}}

⚠️ Ce lien expire dans 7 jours.',
 'Télécharger maintenant',
 true, true, false, false)

ON CONFLICT (template_key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Public read access (for Edge Functions)
CREATE POLICY "email_templates_public_read" ON public.email_templates
    FOR SELECT USING (true);

-- Only admins can update
CREATE POLICY "email_templates_admin_update" ON public.email_templates
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "email_templates_admin_insert" ON public.email_templates
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );

-- Trigger for updated_at
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
    FOR EACH ROW
    EXECUTE FUNCTION update_email_templates_updated_at();

COMMENT ON TABLE public.email_templates IS 'Individual email templates for each email type';
