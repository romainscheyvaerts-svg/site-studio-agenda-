-- ================================================
-- EXÉCUTE CE SCRIPT DANS SUPABASE SQL EDITOR
-- Pour activer le tri personnalisé des instrumentaux
-- ================================================

-- 1. Ajouter la colonne sort_order si elle n'existe pas
ALTER TABLE public.instrumentals 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 2. Définir un ordre initial basé sur created_at (les plus récents en premier)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
  FROM public.instrumentals
)
UPDATE public.instrumentals i
SET sort_order = n.rn
FROM numbered n
WHERE i.id = n.id;

-- 3. Créer un index pour des performances optimales
CREATE INDEX IF NOT EXISTS idx_instrumentals_sort_order ON public.instrumentals(sort_order);

-- 4. Vérification : voir l'ordre actuel
SELECT id, title, sort_order, is_active, created_at 
FROM public.instrumentals 
ORDER BY is_active DESC, sort_order ASC;
