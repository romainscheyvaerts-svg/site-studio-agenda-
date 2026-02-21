-- Add composition service to the services table
INSERT INTO public.services (service_key, name_fr, base_price, price_unit, sort_order, is_active)
VALUES ('composition', 'Composition', 45, 'hourly', 7, true)
ON CONFLICT (service_key) DO NOTHING;
