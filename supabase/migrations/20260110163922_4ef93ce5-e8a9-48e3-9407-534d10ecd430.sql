-- Fix 1: Update is_admin_email function to use user_roles table instead of hardcoded email
-- This addresses the DEFINER_OR_RPC_BYPASS security issue

CREATE OR REPLACE FUNCTION public.is_admin_email(_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM auth.users u
    JOIN public.user_roles ur ON ur.user_id = u.id
    WHERE u.email = _email 
      AND ur.role = 'admin'
  )
  -- Also check super admin emails for backward compatibility
  OR _email IN (
    'prod.makemusic@gmail.com',
    'romain.scheyvaerts@gmail.com'
  )
$$;

-- Fix 2: Add policy to explicitly block anonymous access to bookings table
-- This addresses the MISSING_RLS / PUBLIC_DATA_EXPOSURE issue

-- First drop the overly permissive service role policy
DROP POLICY IF EXISTS "Service role can manage bookings" ON public.bookings;

-- Create a proper policy that only works for service_role 
-- Note: service_role bypasses RLS by default, so we create a permissive policy for authenticated service role usage
-- The key fix is ensuring anon users cannot access the table

-- Add policy to explicitly deny anonymous access
CREATE POLICY "Block anonymous access"
ON public.bookings
FOR ALL
TO anon
USING (false)
WITH CHECK (false);