-- Fix PUBLIC_DATA_EXPOSURE: Remove public read access to promo_codes table
-- The validate-promo-code edge function uses service role and will still work

-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can read promo codes" ON public.promo_codes;

-- Add admin-only SELECT policy for the AdminPanel
CREATE POLICY "Admins can read promo codes"
ON public.promo_codes
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));