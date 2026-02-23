-- Script pour ajouter les services Podcast et Composition à la table services
-- Exécutez ce script dans le SQL Editor de Supabase

-- Vérifier d'abord que la table services existe
-- SELECT * FROM public.services;

-- Ajouter le service Podcast (s'il n'existe pas déjà)
INSERT INTO public.services (service_key, name_fr, base_price, price_unit, sort_order, is_active)
VALUES ('podcast', 'Mixage Podcast', 40, 'per_minute', 6, true)
ON CONFLICT (service_key) DO UPDATE SET 
  name_fr = EXCLUDED.name_fr,
  base_price = COALESCE(NULLIF(public.services.base_price, 0), EXCLUDED.base_price),
  price_unit = EXCLUDED.price_unit,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- Ajouter le service Composition (s'il n'existe pas déjà)
INSERT INTO public.services (service_key, name_fr, base_price, price_unit, sort_order, is_active)
VALUES ('composition', 'Composition', 200, 'fixed', 7, true)
ON CONFLICT (service_key) DO UPDATE SET 
  name_fr = EXCLUDED.name_fr,
  base_price = COALESCE(NULLIF(public.services.base_price, 0), EXCLUDED.base_price),
  price_unit = EXCLUDED.price_unit,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- Vérifier les résultats
SELECT * FROM public.services ORDER BY sort_order;
