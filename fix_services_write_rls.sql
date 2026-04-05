-- Vérifier les politiques existantes sur services
SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'services';

-- Ajouter les politiques INSERT/UPDATE/DELETE pour les utilisateurs authentifiés
DROP POLICY IF EXISTS "services_auth_insert" ON services;
CREATE POLICY "services_auth_insert" ON services
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "services_auth_update" ON services;
CREATE POLICY "services_auth_update" ON services
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "services_auth_delete" ON services;
CREATE POLICY "services_auth_delete" ON services
  FOR DELETE
  TO authenticated
  USING (true);

-- Faire de même pour sales_config
DROP POLICY IF EXISTS "sales_config_auth_update" ON sales_config;
CREATE POLICY "sales_config_auth_update" ON sales_config
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "sales_config_auth_insert" ON sales_config;
CREATE POLICY "sales_config_auth_insert" ON sales_config
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "sales_config_auth_delete" ON sales_config;
CREATE POLICY "sales_config_auth_delete" ON sales_config
  FOR DELETE
  TO authenticated
  USING (true);
