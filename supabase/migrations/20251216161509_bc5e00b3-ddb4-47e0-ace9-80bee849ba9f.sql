-- Ajouter des colonnes pour prix fixes personnalisés et acompte obligatoire
ALTER TABLE public.promo_codes 
ADD COLUMN IF NOT EXISTS custom_price_with_engineer numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS custom_price_without_engineer numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS require_full_payment boolean DEFAULT false;

-- Mettre à jour le code prixdami777 avec les prix spéciaux
UPDATE public.promo_codes 
SET 
  custom_price_with_engineer = 20,
  custom_price_without_engineer = 10,
  require_full_payment = true
WHERE code = 'prixdami777';