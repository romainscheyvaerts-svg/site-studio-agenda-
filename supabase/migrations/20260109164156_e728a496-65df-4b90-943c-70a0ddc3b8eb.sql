CREATE OR REPLACE FUNCTION public.is_admin_email(_email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _email IN (
    'prod.makemusic@gmail.com',
    'kazamzamka@gmail.com',
    'romain.scheyvaerts@gmail.com'
  )
$function$;