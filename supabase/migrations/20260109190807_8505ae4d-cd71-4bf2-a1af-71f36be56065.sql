CREATE OR REPLACE FUNCTION public.is_admin_email(_email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT _email IN (
    'prod.makemusic@gmail.com',
    'romain.scheyvaerts@gmail.com'
  )
$$;