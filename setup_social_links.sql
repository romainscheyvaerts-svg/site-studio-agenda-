-- ============================================
-- SOCIAL LINKS - Liens réseaux sociaux
-- Exécuter ce script dans l'éditeur SQL de Supabase
-- ============================================

-- Table pour stocker les liens des réseaux sociaux
CREATE TABLE IF NOT EXISTS public.social_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL, -- 'tiktok', 'instagram', 'youtube', 'facebook', 'twitter', 'spotify', 'soundcloud'
  url text NOT NULL,
  display_name text, -- Nom affiché (ex: @makemusicstudio)
  icon_name text, -- Nom de l'icône Lucide
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pour le tri
CREATE INDEX IF NOT EXISTS idx_social_links_sort ON social_links(sort_order);

-- RLS
ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Social links are viewable by everyone" ON public.social_links;
DROP POLICY IF EXISTS "Admins can manage social links" ON public.social_links;

-- Politique de lecture publique
CREATE POLICY "Social links are viewable by everyone"
  ON public.social_links FOR SELECT
  USING (is_active = true);

-- Politique d'écriture admin
CREATE POLICY "Admins can manage social links"
  ON public.social_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'superadmin')
    )
  );

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_social_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS social_links_updated_at ON social_links;
CREATE TRIGGER social_links_updated_at
  BEFORE UPDATE ON social_links
  FOR EACH ROW
  EXECUTE FUNCTION update_social_links_updated_at();

-- Insérer quelques exemples (uniquement si la table est vide)
INSERT INTO public.social_links (platform, url, display_name, icon_name, sort_order)
SELECT * FROM (VALUES
  ('instagram', 'https://instagram.com/makemusicstudio', '@makemusicstudio', 'Instagram', 1),
  ('tiktok', 'https://tiktok.com/@makemusicstudio', '@makemusicstudio', 'Music2', 2),
  ('youtube', 'https://youtube.com/@makemusicstudio', 'Make Music Studio', 'Youtube', 3)
) AS v(platform, url, display_name, icon_name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.social_links);

-- Vérification
SELECT * FROM public.social_links ORDER BY sort_order;
