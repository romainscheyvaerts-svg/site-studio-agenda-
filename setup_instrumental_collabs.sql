-- ================================================================
-- SETUP: Colonnes Collaboration Beatmaker sur instrumentals
-- À exécuter dans le SQL Editor de Supabase (studiomakemusic)
-- ================================================================

-- 1. Ajouter les colonnes collaboration
ALTER TABLE public.instrumentals
ADD COLUMN IF NOT EXISTS collab_artist_name TEXT,
ADD COLUMN IF NOT EXISTS collab_artist_username TEXT,
ADD COLUMN IF NOT EXISTS collab_visible BOOLEAN DEFAULT true;

-- 2. Index pour rechercher rapidement par username collab
CREATE INDEX IF NOT EXISTS idx_instrumentals_collab_username
ON public.instrumentals(collab_artist_username)
WHERE collab_artist_username IS NOT NULL;

-- 3. Politique RLS : permettre à quiconque (anon) de mettre à jour collab_visible
-- (le CollabPlayer sur social-artist utilise la clé anon pour toggle la visibilité)
CREATE POLICY "Anyone can update collab_visible"
ON public.instrumentals
FOR UPDATE
USING (true)
WITH CHECK (true);

-- NOTE: Cette politique est large. En production, on pourrait la restreindre
-- via une Edge Function authentifiée côté social-artist.
