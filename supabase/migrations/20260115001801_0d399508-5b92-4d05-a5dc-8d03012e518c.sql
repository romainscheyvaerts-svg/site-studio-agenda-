-- Create table to track promo code usage per user
CREATE TABLE public.promo_code_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for efficient lookups
CREATE INDEX idx_promo_code_usage_code_email ON public.promo_code_usage(promo_code_id, user_email);
CREATE INDEX idx_promo_code_usage_email ON public.promo_code_usage(user_email);

-- Add usage limit column to promo_codes table
ALTER TABLE public.promo_codes 
ADD COLUMN max_uses_per_user INTEGER DEFAULT NULL;

-- Enable RLS
ALTER TABLE public.promo_code_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Allow admins to manage promo code usage
CREATE POLICY "Admins can manage promo code usage"
ON public.promo_code_usage
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')
  )
);

-- Policy: Allow service role to insert usage (from edge functions)
CREATE POLICY "Service role can insert usage"
ON public.promo_code_usage
FOR INSERT
WITH CHECK (true);