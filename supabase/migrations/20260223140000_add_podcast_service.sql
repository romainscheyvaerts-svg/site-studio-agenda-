-- Add podcast service to the services table
INSERT INTO public.services (service_key, name_fr, base_price, price_unit, sort_order, is_active)
VALUES ('podcast', 'Mixage Podcast', 40, 'fixed', 6, true)
ON CONFLICT (service_key) DO NOTHING;
