-- Vérifier et ajouter RLS SELECT public sur services et sales_config
-- Pour que les visiteurs non-authentifiés puissent voir les prix

-- Activer RLS si pas déjà fait
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_config ENABLE ROW LEVEL SECURITY;

-- Politique SELECT publique pour services
DROP POLICY IF EXISTS "services_public_read" ON services;
CREATE POLICY "services_public_read" ON services
  FOR SELECT
  USING (true);

-- Politique SELECT publique pour sales_config
DROP POLICY IF EXISTS "sales_config_public_read" ON sales_config;
CREATE POLICY "sales_config_public_read" ON sales_config
  FOR SELECT
  USING (true);
