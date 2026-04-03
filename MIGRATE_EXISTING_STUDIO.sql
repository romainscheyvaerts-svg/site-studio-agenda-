-- 1. Créer le studio Make Music
INSERT INTO studios (slug, name, description, city, country, subscription_status, is_active)
VALUES ('make-music', 'Make Music Studio', 'Studio d''enregistrement professionnel', 'Bruxelles', 'BE', 'active', true)
ON CONFLICT (slug) DO NOTHING;

-- 2. Assigner le premier admin comme owner
INSERT INTO studio_members (studio_id, user_id, role)
SELECT s.id, ur.user_id, 'owner'::studio_role
FROM studios s CROSS JOIN user_roles ur
WHERE s.slug = 'make-music' AND ur.role IN ('admin', 'superadmin')
AND NOT EXISTS (SELECT 1 FROM studio_members sm WHERE sm.studio_id = s.id AND sm.user_id = ur.user_id);

-- 3. Migrer toutes les données existantes
UPDATE bookings SET studio_id = (SELECT id FROM studios WHERE slug = 'make-music') WHERE studio_id IS NULL;
UPDATE services SET studio_id = (SELECT id FROM studios WHERE slug = 'make-music') WHERE studio_id IS NULL;
UPDATE service_features SET studio_id = (SELECT id FROM studios WHERE slug = 'make-music') WHERE studio_id IS NULL;
UPDATE sales_config SET studio_id = (SELECT id FROM studios WHERE slug = 'make-music') WHERE studio_id IS NULL;
UPDATE gallery_photos SET studio_id = (SELECT id FROM studios WHERE slug = 'make-music') WHERE studio_id IS NULL;
UPDATE instrumentals SET studio_id = (SELECT id FROM studios WHERE slug = 'make-music') WHERE studio_id IS NULL;
UPDATE instrumental_licenses SET studio_id = (SELECT id FROM studios WHERE slug = 'make-music') WHERE studio_id IS NULL;
UPDATE instrumental_purchases SET studio_id = (SELECT id FROM studios WHERE slug = 'make-music') WHERE studio_id IS NULL;
UPDATE client_drive_folders SET studio_id = (SELECT id FROM studios WHERE slug = 'make-music') WHERE studio_id IS NULL;
UPDATE promo_codes SET studio_id = (SELECT id FROM studios WHERE slug = 'make-music') WHERE studio_id IS NULL;
UPDATE promo_code_usage SET studio_id = (SELECT id FROM studios WHERE slug = 'make-music') WHERE studio_id IS NULL;
UPDATE chatbot_config SET studio_id = (SELECT id FROM studios WHERE slug = 'make-music') WHERE studio_id IS NULL;
UPDATE email_config SET studio_id = (SELECT id FROM studios WHERE slug = 'make-music') WHERE studio_id IS NULL;
UPDATE email_templates SET studio_id = (SELECT id FROM studios WHERE slug = 'make-music') WHERE studio_id IS NULL;
UPDATE site_config SET studio_id = (SELECT id FROM studios WHERE slug = 'make-music') WHERE studio_id IS NULL;
UPDATE activity_logs SET studio_id = (SELECT id FROM studios WHERE slug = 'make-music') WHERE studio_id IS NULL;
UPDATE social_links SET studio_id = (SELECT id FROM studios WHERE slug = 'make-music') WHERE studio_id IS NULL;
UPDATE pricing_content SET studio_id = (SELECT id FROM studios WHERE slug = 'make-music') WHERE studio_id IS NULL;
UPDATE blocked_ips SET studio_id = (SELECT id FROM studios WHERE slug = 'make-music') WHERE studio_id IS NULL;
UPDATE blocked_users SET studio_id = (SELECT id FROM studios WHERE slug = 'make-music') WHERE studio_id IS NULL;
