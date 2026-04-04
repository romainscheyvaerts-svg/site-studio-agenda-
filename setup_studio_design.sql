-- Studio Design Customization Columns
-- Run this in Supabase SQL Editor

-- Hero section customization
ALTER TABLE studios ADD COLUMN IF NOT EXISTS hero_title_line1 TEXT DEFAULT NULL;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS hero_title_line2 TEXT DEFAULT NULL;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS hero_subtitle TEXT DEFAULT NULL;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS hero_image_url TEXT DEFAULT NULL;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT NULL;

-- Section toggles (what to show/hide)
ALTER TABLE studios ADD COLUMN IF NOT EXISTS show_pricing BOOLEAN DEFAULT true;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS show_instrumentals BOOLEAN DEFAULT true;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS show_gallery BOOLEAN DEFAULT true;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS show_chatbot BOOLEAN DEFAULT true;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS show_gear BOOLEAN DEFAULT true;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS show_booking BOOLEAN DEFAULT true;

-- Typography
ALTER TABLE studios ADD COLUMN IF NOT EXISTS font_family TEXT DEFAULT 'Inter';

-- Contact / Social
ALTER TABLE studios ADD COLUMN IF NOT EXISTS social_instagram TEXT DEFAULT NULL;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS social_facebook TEXT DEFAULT NULL;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS social_tiktok TEXT DEFAULT NULL;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS social_youtube TEXT DEFAULT NULL;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS social_spotify TEXT DEFAULT NULL;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS social_website TEXT DEFAULT NULL;

-- Custom footer text
ALTER TABLE studios ADD COLUMN IF NOT EXISTS footer_text TEXT DEFAULT NULL;

-- Navbar style
ALTER TABLE studios ADD COLUMN IF NOT EXISTS navbar_style TEXT DEFAULT 'transparent' CHECK (navbar_style IN ('transparent', 'solid', 'gradient'));
