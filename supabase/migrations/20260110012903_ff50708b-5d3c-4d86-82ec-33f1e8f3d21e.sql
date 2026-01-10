-- Create a table to store site configuration including DAW URL
CREATE TABLE public.site_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

-- Everyone can read config (for DAW URL)
CREATE POLICY "Anyone can read site config"
ON public.site_config
FOR SELECT
USING (true);

-- Only admins can update config
CREATE POLICY "Admins can update site config"
ON public.site_config
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can insert config
CREATE POLICY "Admins can insert site config"
ON public.site_config
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_site_config_updated_at
BEFORE UPDATE ON public.site_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default DAW URL
INSERT INTO public.site_config (config_key, config_value, description)
VALUES ('daw_url', 'https://glowing-space-umbrella-v69756456w74hwvpv-3000.app.github.dev/', 'URL du DAW Nova Studio externe');