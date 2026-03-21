-- ============================================
-- Exécuter ce SQL dans Supabase SQL Editor
-- Change le default de is_active à false pour les instrumentaux
-- Les nouveaux instrumentaux seront inactifs par défaut
-- ============================================

ALTER TABLE public.instrumentals ALTER COLUMN is_active SET DEFAULT false;

-- Vérification
SELECT column_name, column_default 
FROM information_schema.columns 
WHERE table_name = 'instrumentals' AND column_name = 'is_active';