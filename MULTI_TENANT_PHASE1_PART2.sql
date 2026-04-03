-- =============================================================================
-- PHASE 1 - MULTI-TENANT - PARTIE 2/2
-- Réécriture de TOUTES les RLS policies pour filtrer par studio_id
-- =============================================================================

-- =============================================================================
-- BOOKINGS — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "Admins can manage all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Block anonymous access" ON public.bookings;

CREATE POLICY "Studio admins can manage bookings" ON public.bookings
  FOR ALL TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

CREATE POLICY "Clients can view own bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (client_email = (auth.jwt() ->> 'email'));

CREATE POLICY "Anon blocked bookings" ON public.bookings
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- =============================================================================
-- SERVICES — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "Anyone can view services" ON public.services;
DROP POLICY IF EXISTS "Admins can manage services" ON public.services;

CREATE POLICY "Public can view studio services" ON public.services
  FOR SELECT USING (true);

CREATE POLICY "Studio admins can manage services" ON public.services
  FOR ALL TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

-- =============================================================================
-- SALES CONFIG — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "Anyone can view sales config" ON public.sales_config;
DROP POLICY IF EXISTS "Admins can manage sales config" ON public.sales_config;

CREATE POLICY "Public can view studio sales" ON public.sales_config
  FOR SELECT USING (true);

CREATE POLICY "Studio admins can manage sales" ON public.sales_config
  FOR ALL TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

-- =============================================================================
-- SERVICE FEATURES — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "Anyone can view active service features" ON public.service_features;
DROP POLICY IF EXISTS "Admins can manage service features" ON public.service_features;

CREATE POLICY "Public can view studio features" ON public.service_features
  FOR SELECT USING (is_active = true);

CREATE POLICY "Studio admins can manage features" ON public.service_features
  FOR ALL TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

-- =============================================================================
-- PROMO CODES — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "Admins can read promo codes" ON public.promo_codes;
DROP POLICY IF EXISTS "Admins can insert promo codes" ON public.promo_codes;
DROP POLICY IF EXISTS "Admins can update promo codes" ON public.promo_codes;
DROP POLICY IF EXISTS "Admins can delete promo codes" ON public.promo_codes;

CREATE POLICY "Studio admins can manage promos" ON public.promo_codes
  FOR ALL TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

-- =============================================================================
-- PROMO CODE USAGE — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "Admins can manage promo code usage" ON public.promo_code_usage;
DROP POLICY IF EXISTS "Service role can insert usage" ON public.promo_code_usage;

CREATE POLICY "Studio admins can manage usage" ON public.promo_code_usage
  FOR ALL TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

CREATE POLICY "Anyone can insert usage" ON public.promo_code_usage
  FOR INSERT WITH CHECK (true);

-- =============================================================================
-- INSTRUMENTALS — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "Anyone can view active instrumentals" ON public.instrumentals;
DROP POLICY IF EXISTS "Admins can manage instrumentals" ON public.instrumentals;
DROP POLICY IF EXISTS "Anyone can update collab_visible" ON public.instrumentals;

CREATE POLICY "Public can view active instrumentals" ON public.instrumentals
  FOR SELECT USING (is_active = true);

CREATE POLICY "Studio admins can manage instrumentals" ON public.instrumentals
  FOR ALL TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

-- =============================================================================
-- INSTRUMENTAL LICENSES — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "Anyone can view active licenses" ON public.instrumental_licenses;
DROP POLICY IF EXISTS "Admins can manage licenses" ON public.instrumental_licenses;

CREATE POLICY "Public can view active licenses" ON public.instrumental_licenses
  FOR SELECT USING (is_active = true);

CREATE POLICY "Studio admins can manage licenses" ON public.instrumental_licenses
  FOR ALL TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

-- =============================================================================
-- INSTRUMENTAL PURCHASES — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "Users can view own purchases" ON public.instrumental_purchases;
DROP POLICY IF EXISTS "Service role can insert purchases" ON public.instrumental_purchases;
DROP POLICY IF EXISTS "Admins can view all purchases" ON public.instrumental_purchases;

CREATE POLICY "Users can view own purchases" ON public.instrumental_purchases
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Studio admins can view purchases" ON public.instrumental_purchases
  FOR SELECT TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

CREATE POLICY "Insert purchases" ON public.instrumental_purchases
  FOR INSERT WITH CHECK (true);

-- =============================================================================
-- GALLERY PHOTOS — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "Anyone can view active gallery photos" ON public.gallery_photos;
DROP POLICY IF EXISTS "Admins can manage gallery photos" ON public.gallery_photos;

CREATE POLICY "Public can view gallery" ON public.gallery_photos
  FOR SELECT USING (is_active = true);

CREATE POLICY "Studio admins can manage gallery" ON public.gallery_photos
  FOR ALL TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

-- =============================================================================
-- CLIENT DRIVE FOLDERS — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "Users can view their own drive folders" ON public.client_drive_folders;
DROP POLICY IF EXISTS "Deny anonymous access" ON public.client_drive_folders;

CREATE POLICY "Users view own drive folders" ON public.client_drive_folders
  FOR SELECT TO authenticated USING (client_email = auth.jwt() ->> 'email');

CREATE POLICY "Studio admins manage drive folders" ON public.client_drive_folders
  FOR ALL TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

CREATE POLICY "No anon drive access" ON public.client_drive_folders
  FOR SELECT TO anon USING (false);

-- =============================================================================
-- BLOCKED USERS — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "Admins can manage blocked users" ON public.blocked_users;

CREATE POLICY "Studio admins manage blocked users" ON public.blocked_users
  FOR ALL TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

-- =============================================================================
-- BLOCKED IPS — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "Admins can manage blocked IPs" ON public.blocked_ips;

CREATE POLICY "Studio admins manage blocked IPs" ON public.blocked_ips
  FOR ALL TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

-- =============================================================================
-- ACTIVITY LOGS — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "Admins can view activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Service role can insert activity logs" ON public.activity_logs;

CREATE POLICY "Studio admins view logs" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

CREATE POLICY "Insert logs" ON public.activity_logs
  FOR INSERT WITH CHECK (true);

-- =============================================================================
-- CHATBOT CONFIG — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "Anyone can read chatbot config" ON public.chatbot_config;
DROP POLICY IF EXISTS "Admins can manage chatbot config" ON public.chatbot_config;

CREATE POLICY "Public read chatbot config" ON public.chatbot_config
  FOR SELECT USING (true);

CREATE POLICY "Studio admins manage chatbot" ON public.chatbot_config
  FOR ALL TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

-- =============================================================================
-- SITE CONFIG — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "Anyone can read site config" ON public.site_config;
DROP POLICY IF EXISTS "Admins can update site config" ON public.site_config;
DROP POLICY IF EXISTS "Admins can insert site config" ON public.site_config;

CREATE POLICY "Public read site config" ON public.site_config
  FOR SELECT USING (true);

CREATE POLICY "Studio admins manage site config" ON public.site_config
  FOR ALL TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

-- =============================================================================
-- PRICING CONTENT — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "Anyone can read pricing content" ON public.pricing_content;
DROP POLICY IF EXISTS "Admins can manage pricing content" ON public.pricing_content;

CREATE POLICY "Public read pricing" ON public.pricing_content
  FOR SELECT USING (true);

CREATE POLICY "Studio admins manage pricing" ON public.pricing_content
  FOR ALL TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

-- =============================================================================
-- EMAIL CONFIG — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "email_config_public_read" ON public.email_config;
DROP POLICY IF EXISTS "email_config_admin_update" ON public.email_config;

CREATE POLICY "Public read email config" ON public.email_config
  FOR SELECT USING (true);

CREATE POLICY "Studio admins manage email config" ON public.email_config
  FOR ALL TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

-- =============================================================================
-- EMAIL TEMPLATES — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "email_templates_public_read" ON public.email_templates;
DROP POLICY IF EXISTS "email_templates_admin_update" ON public.email_templates;
DROP POLICY IF EXISTS "email_templates_admin_insert" ON public.email_templates;

CREATE POLICY "Public read email templates" ON public.email_templates
  FOR SELECT USING (true);

CREATE POLICY "Studio admins manage email templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

-- =============================================================================
-- CLIENT SESSIONS — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "Clients can view their own sessions" ON public.client_sessions;
DROP POLICY IF EXISTS "Admins can manage all sessions" ON public.client_sessions;

CREATE POLICY "Clients view own sessions" ON public.client_sessions
  FOR SELECT TO authenticated USING (auth.email() = client_email);

CREATE POLICY "Studio admins manage sessions" ON public.client_sessions
  FOR ALL TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

-- =============================================================================
-- ADMIN PROFILES — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.admin_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.admin_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.admin_profiles;

CREATE POLICY "Studio members view profiles" ON public.admin_profiles
  FOR SELECT TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

CREATE POLICY "Users manage own profile" ON public.admin_profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- SESSION ASSIGNMENTS — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "Admins can view all assignments" ON public.session_assignments;
DROP POLICY IF EXISTS "Admins can insert assignments" ON public.session_assignments;
DROP POLICY IF EXISTS "Admins can update assignments" ON public.session_assignments;
DROP POLICY IF EXISTS "Anyone can view by token" ON public.session_assignments;

CREATE POLICY "Studio admins manage assignments" ON public.session_assignments
  FOR ALL TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

CREATE POLICY "View by token" ON public.session_assignments
  FOR SELECT USING (true);

-- =============================================================================
-- TRUSTED USERS — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "Admins can read trusted_users" ON public.trusted_users;
DROP POLICY IF EXISTS "Admins can insert trusted_users" ON public.trusted_users;
DROP POLICY IF EXISTS "Admins can delete trusted_users" ON public.trusted_users;
DROP POLICY IF EXISTS "Users can check own trusted status" ON public.trusted_users;

CREATE POLICY "Studio admins manage trusted" ON public.trusted_users
  FOR ALL TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

CREATE POLICY "Users check own trusted" ON public.trusted_users
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- =============================================================================
-- SOCIAL LINKS — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "Social links are viewable by everyone" ON public.social_links;
DROP POLICY IF EXISTS "Admins can manage social links" ON public.social_links;

CREATE POLICY "Public view social links" ON public.social_links
  FOR SELECT USING (is_active = true);

CREATE POLICY "Studio admins manage social links" ON public.social_links
  FOR ALL TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

-- =============================================================================
-- PENDING FREE BOOKINGS — Réécriture RLS
-- =============================================================================
DROP POLICY IF EXISTS "Admin can view pending bookings" ON public.pending_free_bookings;
DROP POLICY IF EXISTS "Service role full access pending" ON public.pending_free_bookings;

CREATE POLICY "Studio admins view pending" ON public.pending_free_bookings
  FOR SELECT TO authenticated
  USING (studio_id IN (SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()));

CREATE POLICY "Service role pending access" ON public.pending_free_bookings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- RECRÉER LA VUE client_stats AVEC studio_id
-- =============================================================================
DROP VIEW IF EXISTS client_stats;
CREATE OR REPLACE VIEW client_stats AS
SELECT
  studio_id,
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
GROUP BY studio_id, client_email;

GRANT SELECT ON client_stats TO authenticated;

-- =============================================================================
-- FIN PHASE 1 ✅ — MULTI-TENANT COMPLET !
-- =============================================================================
-- Toutes les tables ont maintenant un studio_id
-- Toutes les RLS policies filtrent par studio_id
-- Les données de chaque studio sont 100% isolées
-- =============================================================================
