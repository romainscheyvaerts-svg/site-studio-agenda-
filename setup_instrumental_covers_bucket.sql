-- =====================================================
-- SETUP: Bucket Storage pour les covers d'instrumentaux
-- Exécutez ce script dans Supabase SQL Editor
-- =====================================================

-- Créer le bucket pour les covers d'instrumentaux
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'instrumental-covers',
  'instrumental-covers',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Supprimer les anciennes policies si elles existent
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can upload covers" ON storage.objects;
  DROP POLICY IF EXISTS "Public can view covers" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can update covers" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can delete covers" ON storage.objects;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Policy: Permettre aux utilisateurs authentifiés d'uploader
CREATE POLICY "Admins can upload covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'instrumental-covers');

-- Policy: Permettre à tous de voir les covers (public)
CREATE POLICY "Public can view covers"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'instrumental-covers');

-- Policy: Permettre aux utilisateurs authentifiés de mettre à jour
CREATE POLICY "Admins can update covers"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'instrumental-covers')
WITH CHECK (bucket_id = 'instrumental-covers');

-- Policy: Permettre aux utilisateurs authentifiés de supprimer
CREATE POLICY "Admins can delete covers"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'instrumental-covers');

-- Vérification
SELECT 'Bucket créé avec succès!' as status, id, name, public 
FROM storage.buckets 
WHERE id = 'instrumental-covers';
