-- Advanced design columns for studios
ALTER TABLE studios ADD COLUMN IF NOT EXISTS hero_title_size TEXT DEFAULT '9xl';
ALTER TABLE studios ADD COLUMN IF NOT EXISTS hero_subtitle_size TEXT DEFAULT 'xl';
ALTER TABLE studios ADD COLUMN IF NOT EXISTS body_text_size TEXT DEFAULT 'base';
ALTER TABLE studios ADD COLUMN IF NOT EXISTS section_title_size TEXT DEFAULT '3xl';
ALTER TABLE studios ADD COLUMN IF NOT EXISTS button_style TEXT DEFAULT 'rounded';
ALTER TABLE studios ADD COLUMN IF NOT EXISTS button_size TEXT DEFAULT 'xl';
ALTER TABLE studios ADD COLUMN IF NOT EXISTS button_layout TEXT DEFAULT 'row';
ALTER TABLE studios ADD COLUMN IF NOT EXISTS hero_layout TEXT DEFAULT 'center';
ALTER TABLE studios ADD COLUMN IF NOT EXISTS show_hero_stats TEXT DEFAULT 'true';
ALTER TABLE studios ADD COLUMN IF NOT EXISTS navbar_position TEXT DEFAULT 'fixed';
