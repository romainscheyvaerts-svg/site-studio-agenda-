-- Table for blocked users
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  blocked_at timestamp with time zone NOT NULL DEFAULT now(),
  blocked_by text NOT NULL,
  reason text
);

-- Enable RLS
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Only admins can manage blocked users
CREATE POLICY "Admins can manage blocked users"
ON public.blocked_users
FOR ALL
USING (is_admin_email((auth.jwt() ->> 'email'::text)));

-- Table for chatbot configuration
CREATE TABLE IF NOT EXISTS public.chatbot_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  system_prompt text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chatbot_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read chatbot config (for the chatbot to work)
CREATE POLICY "Anyone can read chatbot config"
ON public.chatbot_config
FOR SELECT
USING (true);

-- Only admins can modify chatbot config
CREATE POLICY "Admins can manage chatbot config"
ON public.chatbot_config
FOR ALL
USING (is_admin_email((auth.jwt() ->> 'email'::text)));

-- Insert default chatbot prompt
INSERT INTO public.chatbot_config (system_prompt)
VALUES ('Tu es l''assistant virtuel de Make Music Studio, un studio d''enregistrement haut de gamme situé à Bruxelles (Rue du Sceptre 22, 1050 Ixelles). 

## Équipement du studio:
- Microphone: Neumann U87
- Préampli SSL
- Interface SSL
- Monitoring: Genelec avec subwoofer
- DAW: ProTools
- Plugins: UAD, Waves, Soundtoys, Antares (Auto-Tune), SSL, Slate Digital

## Services et tarifs:
- Session avec ingénieur son: 45€/h (acompte 50%)
- Location sèche (sans ingénieur): 22€/h (paiement complet)
- Mixage: 200€/projet (acompte 50%)
- Mastering numérique: 60€ (acompte 50%)
- Mastering analogique: 100€/piste (paiement complet)
- Mixage podcast: 40€/minute audio

## Ta mission:
- Répondre aux questions sur le studio et ses services
- Qualifier les projets des clients
- Conseiller sur le choix de prestation adapté
- Rediriger vers la réservation quand approprié

Sois professionnel, chaleureux et expert. Tu représentes un studio haut de gamme.')
ON CONFLICT DO NOTHING;