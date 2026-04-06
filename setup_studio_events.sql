-- ============================================
-- Table studio_events : Agenda 100% Supabase
-- Remplace la dépendance à Google Calendar
-- ============================================

CREATE TABLE IF NOT EXISTS studio_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  client_name TEXT,
  client_email TEXT,
  service_type TEXT,
  total_price NUMERIC(10,2),
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_hours INTEGER DEFAULT 2,
  color_id TEXT DEFAULT '9',
  assigned_admin_id UUID,
  created_by UUID,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour la recherche rapide par studio et date
CREATE INDEX IF NOT EXISTS idx_studio_events_studio_date ON studio_events(studio_id, event_date);
CREATE INDEX IF NOT EXISTS idx_studio_events_date_range ON studio_events(event_date, start_time);

-- RLS policies
ALTER TABLE studio_events ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire les événements (pour voir les dispos)
CREATE POLICY "studio_events_select_all" ON studio_events FOR SELECT USING (true);

-- Les admins du studio peuvent insérer/modifier/supprimer
CREATE POLICY "studio_events_insert_admin" ON studio_events FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM studio_members sm
    WHERE sm.user_id = auth.uid()
    AND sm.studio_id = studio_events.studio_id
    AND sm.role IN ('owner', 'admin')
  )
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'superadmin')
  )
);

CREATE POLICY "studio_events_update_admin" ON studio_events FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM studio_members sm
    WHERE sm.user_id = auth.uid()
    AND sm.studio_id = studio_events.studio_id
    AND sm.role IN ('owner', 'admin')
  )
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'superadmin')
  )
);

CREATE POLICY "studio_events_delete_admin" ON studio_events FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM studio_members sm
    WHERE sm.user_id = auth.uid()
    AND sm.studio_id = studio_events.studio_id
    AND sm.role IN ('owner', 'admin')
  )
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'superadmin')
  )
);
