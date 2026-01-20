-- Add translation columns to service_features table
ALTER TABLE public.service_features
ADD COLUMN IF NOT EXISTS feature_text_en TEXT,
ADD COLUMN IF NOT EXISTS feature_text_nl TEXT,
ADD COLUMN IF NOT EXISTS feature_text_es TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.service_features.feature_text IS 'French text (default/source language)';
COMMENT ON COLUMN public.service_features.feature_text_en IS 'English translation';
COMMENT ON COLUMN public.service_features.feature_text_nl IS 'Dutch translation';
COMMENT ON COLUMN public.service_features.feature_text_es IS 'Spanish translation';
