-- Migration: Add admin session assignment notification template
-- and email field to admin_profiles

-- 1. Add email field to admin_profiles table (to notify them)
ALTER TABLE admin_profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Update email from auth.users if possible
UPDATE admin_profiles ap
SET email = (
  SELECT email FROM auth.users au WHERE au.id = ap.user_id
)
WHERE ap.email IS NULL;

-- 2. Add new email template for admin session assignment
INSERT INTO public.email_templates (
  template_key, 
  template_name, 
  template_description, 
  subject_template, 
  heading_text, 
  subheading_text, 
  body_template, 
  cta_button_text, 
  cta_button_url_template,
  show_logo,
  show_session_details, 
  show_price, 
  show_calendar_button, 
  show_drive_link,
  show_social_links
) VALUES (
  'admin_session_assignment',
  'Notification Session Admin',
  'Email envoyé à l''admin assigné quand il est responsable d''une nouvelle session',
  '📅 Nouvelle session assignée - {{session_date}} à {{start_time}}',
  '🎤 Nouvelle session à gérer !',
  'Vous avez été assigné(e) à une session d''enregistrement.',
  'Bonjour {{admin_name}},

Une nouvelle session vous a été assignée :

📅 Date: {{session_date}}
🕐 Horaire: {{start_time}} - {{end_time}}
⏱️ Durée: {{duration}}h
🎤 Session: {{session_title}}

{{#if client_name}}
👤 Client: {{client_name}}
{{/if}}

{{#if notes}}
📝 Notes:
{{notes}}
{{/if}}

Cliquez sur le bouton ci-dessous pour ajouter cet événement à votre agenda personnel.',
  'Ajouter à mon agenda',
  '{{calendar_add_url}}',
  true,
  true, 
  false, 
  true, 
  false,
  false
) ON CONFLICT (template_key) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  template_description = EXCLUDED.template_description,
  subject_template = EXCLUDED.subject_template,
  heading_text = EXCLUDED.heading_text,
  subheading_text = EXCLUDED.subheading_text,
  body_template = EXCLUDED.body_template,
  cta_button_text = EXCLUDED.cta_button_text,
  cta_button_url_template = EXCLUDED.cta_button_url_template,
  show_session_details = EXCLUDED.show_session_details,
  show_price = EXCLUDED.show_price,
  show_calendar_button = EXCLUDED.show_calendar_button,
  show_drive_link = EXCLUDED.show_drive_link;

COMMENT ON COLUMN admin_profiles.email IS 'Email de l''admin pour recevoir les notifications de sessions assignées';
