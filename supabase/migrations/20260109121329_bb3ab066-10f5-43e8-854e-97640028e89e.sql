-- Create table for service features
CREATE TABLE public.service_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_key TEXT NOT NULL,
  feature_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_features ENABLE ROW LEVEL SECURITY;

-- Anyone can view active features
CREATE POLICY "Anyone can view active service features"
ON public.service_features
FOR SELECT
USING (is_active = true);

-- Admins can manage features
CREATE POLICY "Admins can manage service features"
ON public.service_features
FOR ALL
USING (is_admin_email((auth.jwt() ->> 'email'::text)));

-- Create trigger for updated_at
CREATE TRIGGER update_service_features_updated_at
BEFORE UPDATE ON public.service_features
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default features for each service
INSERT INTO public.service_features (service_key, feature_text, sort_order) VALUES
-- with-engineer
('with-engineer', 'Ingénieur son dédié', 1),
('with-engineer', 'Mix en temps réel', 2),
('with-engineer', 'Conseils artistiques', 3),
('with-engineer', 'Export multipistes', 4),

-- without-engineer
('without-engineer', 'Studio en autonomie', 1),
('without-engineer', 'Équipement inclus', 2),
('without-engineer', 'Accès 24/7 possible', 3),
('without-engineer', 'Support technique', 4),

-- mixing
('mixing', 'Mix professionnel', 1),
('mixing', 'Mastering inclus (60€)', 2),
('mixing', 'Révisions incluses', 3),
('mixing', 'Plugins premium', 4),
('mixing', 'Lien Drive envoyé par mail', 5),

-- mastering
('mastering', 'Traitement numérique', 1),
('mastering', 'Loudness optimisé', 2),
('mastering', 'Format streaming', 3),
('mastering', 'Fichier WAV + MP3', 4),

-- analog-mastering
('analog-mastering', 'Console SSL', 1),
('analog-mastering', 'Couleur analogique', 2),
('analog-mastering', 'Loudness optimisé', 3),
('analog-mastering', 'Session d''écoute studio', 4),

-- podcast
('podcast', 'Nettoyage audio', 1),
('podcast', 'Égalisation voix', 2),
('podcast', 'Montage si nécessaire', 3),
('podcast', 'Export optimisé podcast', 4);