-- Table pour stocker l'historique des sessions clients (comptabilité)
CREATE TABLE IF NOT EXISTS client_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email TEXT NOT NULL,
  client_name TEXT,
  session_date DATE NOT NULL,
  session_type TEXT NOT NULL, -- 'with-engineer', 'without-engineer', 'mixing', 'mastering', 'analog-mastering', 'podcast'
  duration_hours NUMERIC(4,1) NOT NULL DEFAULT 1,
  base_price NUMERIC(10,2) NOT NULL,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  final_price NUMERIC(10,2) NOT NULL,
  payment_method TEXT DEFAULT 'online', -- 'online', 'cash', 'free'
  payment_status TEXT DEFAULT 'paid', -- 'paid', 'pending', 'partial'
  notes TEXT,
  google_event_id TEXT, -- Lien avec l'événement Google Calendar si disponible
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_client_sessions_email ON client_sessions(client_email);
CREATE INDEX IF NOT EXISTS idx_client_sessions_date ON client_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_client_sessions_type ON client_sessions(session_type);

-- RLS Policies
ALTER TABLE client_sessions ENABLE ROW LEVEL SECURITY;

-- Les clients peuvent voir leurs propres sessions
CREATE POLICY "Clients can view their own sessions"
  ON client_sessions
  FOR SELECT
  USING (
    auth.email() = client_email
  );

-- Les admins peuvent tout faire
CREATE POLICY "Admins can manage all sessions"
  ON client_sessions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_client_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_client_sessions_updated_at
  BEFORE UPDATE ON client_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_client_sessions_updated_at();

-- Vue pour les statistiques agrégées par client
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

-- Donner accès à la vue
GRANT SELECT ON client_stats TO authenticated;