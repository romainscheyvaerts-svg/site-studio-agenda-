-- Fix script pour les tables admin
-- Exécuter dans Supabase SQL Editor

-- 1. Créer la table admin_profiles si elle n'existe pas
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

-- 2. Créer la table session_assignments si elle n'existe pas
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

-- 3. Créer les index si ils n'existent pas
CREATE INDEX IF NOT EXISTS idx_admin_profiles_user_id ON admin_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_session_assignments_event_id ON session_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_session_assignments_created_by ON session_assignments(created_by);
CREATE INDEX IF NOT EXISTS idx_session_assignments_assigned_to ON session_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_session_assignments_token ON session_assignments(assignment_token);

-- 4. Activer RLS
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_assignments ENABLE ROW LEVEL SECURITY;

-- 5. Supprimer les anciennes policies et recréer
DROP POLICY IF EXISTS "Admins can view all profiles" ON admin_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON admin_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON admin_profiles;
DROP POLICY IF EXISTS "Admins can view all assignments" ON session_assignments;
DROP POLICY IF EXISTS "Admins can insert assignments" ON session_assignments;
DROP POLICY IF EXISTS "Admins can update assignments" ON session_assignments;
DROP POLICY IF EXISTS "Anyone can view by token" ON session_assignments;

-- RLS Policies for admin_profiles
CREATE POLICY "Admins can view all profiles" ON admin_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

CREATE POLICY "Users can update their own profile" ON admin_profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON admin_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for session_assignments
CREATE POLICY "Admins can view all assignments" ON session_assignments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

CREATE POLICY "Admins can insert assignments" ON session_assignments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

CREATE POLICY "Admins can update assignments" ON session_assignments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

CREATE POLICY "Anyone can view by token" ON session_assignments
  FOR SELECT USING (true);

-- 6. Créer le template email s'il n'existe pas
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
) ON CONFLICT (template_key) DO NOTHING;

SELECT 'Tables et policies créées avec succès!' as result;
