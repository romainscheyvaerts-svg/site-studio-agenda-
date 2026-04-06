-- Add email template customization columns to studios
ALTER TABLE studios ADD COLUMN IF NOT EXISTS email_greeting TEXT DEFAULT 'Bonjour {clientName},';
ALTER TABLE studios ADD COLUMN IF NOT EXISTS email_custom_message TEXT DEFAULT '';
ALTER TABLE studios ADD COLUMN IF NOT EXISTS email_noreply_text TEXT DEFAULT '⚠️ Ceci est un email automatique, merci de ne pas y répondre.';
ALTER TABLE studios ADD COLUMN IF NOT EXISTS email_show_phone BOOLEAN DEFAULT true;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS email_show_google_calendar BOOLEAN DEFAULT true;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS email_show_drive_link BOOLEAN DEFAULT true;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS email_footer_text TEXT DEFAULT '';
ALTER TABLE studios ADD COLUMN IF NOT EXISTS email_contact_text TEXT DEFAULT 'Pour toute question, contactez-nous par téléphone ou via nos réseaux sociaux.';
