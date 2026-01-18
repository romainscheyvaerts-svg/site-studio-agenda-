-- Migration: Email Template Configuration
-- This table stores customizable email template settings for all outgoing emails

CREATE TABLE IF NOT EXISTS public.email_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Colors
    primary_color VARCHAR(7) DEFAULT '#22d3ee',      -- Cyan accent (buttons, links)
    secondary_color VARCHAR(7) DEFAULT '#7c3aed',    -- Purple accent
    background_color VARCHAR(7) DEFAULT '#0a0a0a',   -- Dark background
    card_color VARCHAR(7) DEFAULT '#1a1a1a',         -- Card/container background
    text_color VARCHAR(7) DEFAULT '#ffffff',         -- Primary text
    muted_text_color VARCHAR(7) DEFAULT '#a1a1aa',   -- Secondary/muted text
    border_color VARCHAR(7) DEFAULT '#262626',       -- Borders
    success_color VARCHAR(7) DEFAULT '#10b981',      -- Success/confirmation

    -- Branding
    logo_url TEXT DEFAULT 'https://www.studiomakemusic.com/favicon.png',
    studio_name VARCHAR(255) DEFAULT 'Make Music Studio',

    -- Footer
    footer_text TEXT DEFAULT 'Make Music Studio - Studio d''enregistrement professionnel à Bruxelles',
    footer_address TEXT DEFAULT 'Rue de la Loi 42, 1000 Bruxelles',
    footer_phone VARCHAR(50) DEFAULT '+32 456 123 789',
    footer_email VARCHAR(255) DEFAULT 'prod.makemusic@gmail.com',

    -- Social links
    social_instagram VARCHAR(255) DEFAULT 'https://instagram.com/makemusic.studio',
    social_facebook VARCHAR(255) DEFAULT '',
    social_youtube VARCHAR(255) DEFAULT '',
    social_tiktok VARCHAR(255) DEFAULT '',

    -- Features
    show_calendar_button BOOLEAN DEFAULT true,       -- Show "Add to calendar" button
    show_social_links BOOLEAN DEFAULT true,          -- Show social media links in footer
    show_logo BOOLEAN DEFAULT true,                  -- Show logo in header

    -- Typography
    font_family VARCHAR(100) DEFAULT 'Arial, Helvetica, sans-serif',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create a single row with default values (singleton pattern)
INSERT INTO public.email_config (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.email_config ENABLE ROW LEVEL SECURITY;

-- Public read access (for Edge Functions to read config)
CREATE POLICY "email_config_public_read" ON public.email_config
    FOR SELECT USING (true);

-- Only admins can update
CREATE POLICY "email_config_admin_update" ON public.email_config
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS email_config_updated_at_trigger ON public.email_config;
CREATE TRIGGER email_config_updated_at_trigger
    BEFORE UPDATE ON public.email_config
    FOR EACH ROW
    EXECUTE FUNCTION update_email_config_updated_at();

-- Add to TypeScript types generation
COMMENT ON TABLE public.email_config IS 'Email template configuration for customizing outgoing emails';
