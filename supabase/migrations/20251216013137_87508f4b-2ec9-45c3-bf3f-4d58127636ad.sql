-- Table des instrumentaux
CREATE TABLE public.instrumentals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  genre TEXT,
  bpm INTEGER,
  key TEXT,
  preview_url TEXT, -- URL du fichier preview (mp3 basse qualité)
  cover_image_url TEXT,
  drive_file_id TEXT NOT NULL, -- ID du fichier Google Drive HQ
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des types de licences
CREATE TABLE public.instrumental_licenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, -- Basic, Premium, Exclusive
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  features TEXT[], -- Liste des avantages
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des achats d'instrumentaux
CREATE TABLE public.instrumental_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  instrumental_id UUID NOT NULL REFERENCES public.instrumentals(id),
  license_id UUID NOT NULL REFERENCES public.instrumental_licenses(id),
  payment_id TEXT, -- Stripe/PayPal payment ID
  payment_method TEXT, -- stripe, paypal
  amount_paid DECIMAL(10,2) NOT NULL,
  download_token TEXT NOT NULL UNIQUE,
  download_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  buyer_email TEXT NOT NULL,
  buyer_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.instrumentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instrumental_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instrumental_purchases ENABLE ROW LEVEL SECURITY;

-- Instrumentals: public read, admin write
CREATE POLICY "Anyone can view active instrumentals"
ON public.instrumentals FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage instrumentals"
ON public.instrumentals FOR ALL
USING (public.is_admin_email(auth.jwt()->>'email'));

-- Licenses: public read, admin write
CREATE POLICY "Anyone can view active licenses"
ON public.instrumental_licenses FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage licenses"
ON public.instrumental_licenses FOR ALL
USING (public.is_admin_email(auth.jwt()->>'email'));

-- Purchases: users see own, admin sees all
CREATE POLICY "Users can view own purchases"
ON public.instrumental_purchases FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert purchases"
ON public.instrumental_purchases FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view all purchases"
ON public.instrumental_purchases FOR SELECT
USING (public.is_admin_email(auth.jwt()->>'email'));

-- Insert default licenses
INSERT INTO public.instrumental_licenses (name, description, price, features, sort_order) VALUES
('Basic', 'Licence de base pour usage non-commercial', 29.00, ARRAY['MP3 + WAV haute qualité', 'Usage streaming (Spotify, Apple Music)', 'Jusqu''à 10 000 streams', 'Crédit obligatoire'], 1),
('Premium', 'Licence complète pour artistes', 79.00, ARRAY['MP3 + WAV + Stems', 'Usage streaming illimité', 'Usage vidéo (YouTube, TikTok)', 'Distribution digitale', 'Crédit recommandé'], 2),
('Exclusive', 'Licence exclusive - vous êtes le seul propriétaire', 299.00, ARRAY['Tous les fichiers sources', 'Droits exclusifs complets', 'Retrait de la vente', 'Usage commercial illimité', 'Aucun crédit requis'], 3);

-- Trigger for updated_at
CREATE TRIGGER update_instrumentals_updated_at
BEFORE UPDATE ON public.instrumentals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();