-- Migration: Create invoice_templates table for customizable invoice design
-- Date: 2026-02-02

-- Create invoice_templates table
CREATE TABLE IF NOT EXISTS invoice_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key VARCHAR(50) UNIQUE NOT NULL,
  template_name VARCHAR(100) NOT NULL,
  template_description TEXT,
  
  -- Company info
  company_name VARCHAR(200) DEFAULT 'Make Music Studio',
  company_address TEXT DEFAULT 'Rue du Sceptre 22\n1050 Ixelles, Bruxelles\nBelgique',
  company_email VARCHAR(255) DEFAULT 'prod.makemusic@gmail.com',
  company_phone VARCHAR(50) DEFAULT '+32 476 09 41 72',
  company_logo_url TEXT,
  
  -- Colors and styling
  primary_color VARCHAR(20) DEFAULT '#22d3ee',
  secondary_color VARCHAR(20) DEFAULT '#1a1a1a',
  text_color VARCHAR(20) DEFAULT '#fafafa',
  accent_color VARCHAR(20) DEFAULT '#262626',
  
  -- Header customization
  show_logo BOOLEAN DEFAULT true,
  header_title VARCHAR(100) DEFAULT 'FACTURE',
  
  -- Footer customization
  footer_text TEXT DEFAULT 'Make Music Studio - Studio d''enregistrement professionnel\nMerci pour votre confiance ! 🎵',
  show_footer BOOLEAN DEFAULT true,
  
  -- Legal info
  legal_mentions TEXT,
  payment_terms TEXT DEFAULT 'Paiement à réception de facture',
  bank_details TEXT,
  vat_number VARCHAR(50),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on template_key for fast lookup
CREATE INDEX IF NOT EXISTS idx_invoice_templates_key ON invoice_templates(template_key);

-- Insert default template
INSERT INTO invoice_templates (
  template_key,
  template_name,
  template_description,
  company_name,
  company_address,
  company_email,
  company_phone,
  primary_color,
  header_title,
  footer_text,
  payment_terms,
  is_active
) VALUES (
  'default',
  'Template par défaut',
  'Template de facture standard Make Music Studio',
  'Make Music Studio',
  'Rue du Sceptre 22
1050 Ixelles, Bruxelles
Belgique',
  'prod.makemusic@gmail.com',
  '+32 476 09 41 72',
  '#22d3ee',
  'FACTURE',
  'Make Music Studio - Studio d''enregistrement professionnel
Merci pour votre confiance ! 🎵',
  'Paiement à réception de facture',
  true
) ON CONFLICT (template_key) DO NOTHING;

-- Enable RLS
ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view/edit invoice templates
CREATE POLICY "Admins can view invoice templates"
  ON invoice_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Admins can update invoice templates"
  ON invoice_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Admins can insert invoice templates"
  ON invoice_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON invoice_templates TO authenticated;

COMMENT ON TABLE invoice_templates IS 'Customizable invoice templates for Make Music Studio';
