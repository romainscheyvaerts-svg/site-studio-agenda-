-- Supprimer l'ancien service mal configuré
DELETE FROM services WHERE service_key = 'enregistrement';

-- Insérer les 7 services standard avec les bons service_keys
INSERT INTO services (service_key, name_fr, base_price, price_unit, is_active, sort_order)
VALUES
  ('with-engineer', 'Avec Ingénieur', 45, '/h', true, 1),
  ('without-engineer', 'Location Sèche', 22, '/h', true, 2),
  ('mixing', 'Mixage', 200, '/projet', true, 3),
  ('mastering', 'Mastering', 60, '/titre', true, 4),
  ('analog-mastering', 'Mastering Analogique', 100, '/titre', true, 5),
  ('podcast', 'Mixage Podcast', 40, '/min', true, 6),
  ('composition', 'Composition', 200, '/projet', true, 7)
ON CONFLICT (service_key) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  base_price = EXCLUDED.base_price,
  price_unit = EXCLUDED.price_unit,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- Vérification
SELECT service_key, name_fr, base_price, price_unit, is_active, sort_order 
FROM services ORDER BY sort_order;
