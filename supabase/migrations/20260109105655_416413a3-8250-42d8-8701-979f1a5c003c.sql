-- Table to store editable pricing section content (multilingual)
CREATE TABLE public.pricing_content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_key text NOT NULL UNIQUE,
  content_fr text NOT NULL DEFAULT '',
  content_en text NOT NULL DEFAULT '',
  content_es text NOT NULL DEFAULT '',
  content_nl text NOT NULL DEFAULT '',
  content_type text NOT NULL DEFAULT 'text',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pricing_content ENABLE ROW LEVEL SECURITY;

-- Anyone can read active content
CREATE POLICY "Anyone can view pricing content"
ON public.pricing_content
FOR SELECT
USING (true);

-- Only admins can manage content
CREATE POLICY "Admins can manage pricing content"
ON public.pricing_content
FOR ALL
USING (is_admin_email((auth.jwt() ->> 'email'::text)));

-- Trigger to auto-update updated_at
CREATE TRIGGER update_pricing_content_updated_at
  BEFORE UPDATE ON public.pricing_content
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default content for section header
INSERT INTO public.pricing_content (content_key, content_fr, content_en, content_es, content_nl, content_type, sort_order) VALUES
  ('section_badge', 'Tarifs transparents', 'Transparent pricing', 'Precios transparentes', 'Transparante prijzen', 'text', 1),
  ('section_title', 'Nos', 'Our', 'Nuestras', 'Onze', 'text', 2),
  ('section_title_highlight', 'offres', 'offers', 'ofertas', 'aanbiedingen', 'text', 3),
  ('section_description', 'Des formules adaptées à tous les projets, de l''enregistrement solo au mastering professionnel', 'Packages adapted to all projects, from solo recording to professional mastering', 'Paquetes adaptados a todos los proyectos, desde grabación en solitario hasta masterización profesional', 'Pakketten aangepast aan alle projecten, van solo-opname tot professionele mastering', 'text', 4);

-- Cards content (titles and subtitles per service)
INSERT INTO public.pricing_content (content_key, content_fr, content_en, content_es, content_nl, content_type, sort_order) VALUES
  ('card_with-engineer_title', 'Enregistrement', 'Recording', 'Grabación', 'Opname', 'text', 10),
  ('card_with-engineer_subtitle', 'Session accompagnée', 'With engineer', 'Sesión asistida', 'Met engineer', 'text', 11),
  ('card_without-engineer_title', 'Location studio', 'Studio rental', 'Alquiler estudio', 'Studiohuur', 'text', 12),
  ('card_without-engineer_subtitle', 'Sans ingénieur', 'Self-service', 'Sin ingeniero', 'Zonder engineer', 'text', 13),
  ('card_mixing_title', 'Mixage', 'Mixing', 'Mezcla', 'Mixen', 'text', 14),
  ('card_mixing_subtitle', 'Piste par piste', 'Track by track', 'Pista por pista', 'Track voor track', 'text', 15),
  ('card_mastering_title', 'Mastering', 'Mastering', 'Masterización', 'Mastering', 'text', 16),
  ('card_mastering_subtitle', 'Finalisation', 'Finalization', 'Finalización', 'Finalisatie', 'text', 17),
  ('card_analog-mastering_title', 'Mastering Premium', 'Premium Mastering', 'Mastering Premium', 'Premium Mastering', 'text', 18),
  ('card_analog-mastering_subtitle', 'Mastering premium', 'Premium mastering', 'Mastering premium', 'Premium mastering', 'text', 19),
  ('card_podcast_title', 'Podcast', 'Podcast', 'Podcast', 'Podcast', 'text', 20),
  ('card_podcast_subtitle', 'Audio podcast', 'Audio podcast', 'Audio podcast', 'Audio podcast', 'text', 21);

-- Features per service (JSON arrays)
INSERT INTO public.pricing_content (content_key, content_fr, content_en, content_es, content_nl, content_type, sort_order) VALUES
  ('features_with-engineer', '["Ingénieur son professionnel","Aide à l''enregistrement et conseils","Utilisation complète du matériel","Export WAV haute qualité"]', '["Professional sound engineer","Recording assistance and advice","Full equipment access","High quality WAV export"]', '["Ingeniero de sonido profesional","Asistencia en grabación","Acceso completo al equipo","Exportación WAV de alta calidad"]', '["Professionele geluidstechnicus","Opname assistentie en advies","Volledige toegang tot apparatuur","Hoge kwaliteit WAV export"]', 'json', 30),
  ('features_without-engineer', '["Accès libre au studio","Matériel professionnel disponible","Ambiance créative","Autonomie totale"]', '["Free studio access","Professional equipment available","Creative atmosphere","Full autonomy"]', '["Acceso libre al estudio","Equipo profesional disponible","Ambiente creativo","Autonomía total"]', '["Vrije toegang tot studio","Professionele apparatuur beschikbaar","Creatieve sfeer","Volledige autonomie"]', 'json', 31),
  ('features_mixing', '["Mix professionnel multi-piste","Équilibre parfait des instruments","Traitement dynamique et spatial","Corrections et automation"]', '["Professional multitrack mix","Perfect instrument balance","Dynamic and spatial processing","Corrections and automation"]', '["Mezcla profesional multipista","Equilibrio perfecto de instrumentos","Procesamiento dinámico y espacial","Correcciones y automatización"]', '["Professionele multitrack mix","Perfecte instrumentbalans","Dynamische en ruimtelijke verwerking","Correcties en automatisering"]', 'json', 32),
  ('features_mastering', '["Mastering numérique professionnel","Loudness optimisé streaming","Export multi-formats","2 révisions incluses"]', '["Professional digital mastering","Streaming-optimized loudness","Multi-format export","2 revisions included"]', '["Masterización digital profesional","Loudness optimizado para streaming","Exportación multi-formatos","2 revisiones incluidas"]', '["Professionele digitale mastering","Streaming-geoptimaliseerde loudness","Multi-format export","2 revisies inbegrepen"]', 'json', 33),
  ('features_analog-mastering', '["Chaîne analogique haut de gamme","Caractère sonore unique","Warmth et profondeur","3 révisions incluses","Format DDP master"]', '["High-end analog chain","Unique sonic character","Warmth and depth","3 revisions included","DDP master format"]', '["Cadena analógica de alta gama","Carácter sonoro único","Calidez y profundidad","3 revisiones incluidas","Formato DDP master"]', '["Hoogwaardige analoge keten","Uniek geluidskarakter","Warmte en diepte","3 revisies inbegrepen","DDP master formaat"]', 'json', 34),
  ('features_podcast', '["Nettoyage audio avancé","Équilibrage des voix","Ajout d''intro/outro","Export multi-plateformes"]', '["Advanced audio cleaning","Voice balancing","Intro/outro addition","Multi-platform export"]', '["Limpieza de audio avanzada","Equilibrio de voces","Adición de intro/outro","Exportación multi-plataformas"]', '["Geavanceerde audio reiniging","Stembalancering","Intro/outro toevoeging","Multi-platform export"]', 'json', 35);

-- Payment modalities section
INSERT INTO public.pricing_content (content_key, content_fr, content_en, content_es, content_nl, content_type, sort_order) VALUES
  ('payment_title', 'MODALITÉS DE PAIEMENT', 'PAYMENT METHODS', 'MÉTODOS DE PAGO', 'BETALINGSWIJZEN', 'text', 50),
  ('payment_deposit_title', 'Acompte 50%', '50% Deposit', 'Depósito 50%', '50% Aanbetaling', 'text', 51),
  ('payment_deposit_note', 'Le reste au studio', 'Remainder at studio', 'El resto en el estudio', 'Rest in de studio', 'text', 52),
  ('payment_full_title', 'Paiement complet', 'Full payment', 'Pago completo', 'Volledige betaling', 'text', 53),
  ('payment_full_note', 'À régler à la réservation', 'Due at booking', 'A pagar en la reserva', 'Te betalen bij reservering', 'text', 54),
  ('payment_footer', 'Forfaits et tarifs dégressifs disponibles pour les projets longs', 'Packages and sliding-scale rates available for long projects', 'Paquetes y tarifas escalonadas disponibles para proyectos largos', 'Pakketten en aflopende tarieven beschikbaar voor lange projecten', 'text', 55);