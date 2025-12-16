-- Table des services avec prix de base
CREATE TABLE public.services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_key text NOT NULL UNIQUE,
  name_fr text NOT NULL,
  base_price numeric NOT NULL,
  price_unit text NOT NULL DEFAULT 'fixed', -- 'hourly' or 'fixed'
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Table de configuration des soldes/promotions
CREATE TABLE public.sales_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_active boolean NOT NULL DEFAULT false,
  sale_name text NOT NULL DEFAULT 'Promotion',
  discount_percentage numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_config ENABLE ROW LEVEL SECURITY;

-- Policies for services - anyone can read, only admins can modify
CREATE POLICY "Anyone can view services" ON public.services FOR SELECT USING (true);
CREATE POLICY "Admins can manage services" ON public.services FOR ALL USING (is_admin_email((auth.jwt() ->> 'email'::text)));

-- Policies for sales_config - anyone can read, only admins can modify  
CREATE POLICY "Anyone can view sales config" ON public.sales_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage sales config" ON public.sales_config FOR ALL USING (is_admin_email((auth.jwt() ->> 'email'::text)));

-- Insert default services
INSERT INTO public.services (service_key, name_fr, base_price, price_unit, sort_order) VALUES
  ('with-engineer', 'Session avec Ingénieur Son', 45, 'hourly', 1),
  ('without-engineer', 'Location Dry (sans ingénieur)', 22, 'hourly', 2),
  ('mixing', 'Mixage', 200, 'fixed', 3),
  ('mastering', 'Mastering Numérique', 60, 'fixed', 4),
  ('analog-mastering', 'Mastering Analogique', 100, 'fixed', 5);

-- Insert default sales config (disabled)
INSERT INTO public.sales_config (is_active, sale_name, discount_percentage) VALUES (false, 'Promotion', 0);

-- Trigger for updated_at
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_config_updated_at
  BEFORE UPDATE ON public.sales_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();