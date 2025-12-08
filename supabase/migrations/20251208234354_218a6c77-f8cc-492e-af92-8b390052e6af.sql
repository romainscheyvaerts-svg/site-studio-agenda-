-- Drop existing policy
DROP POLICY IF EXISTS "Service role can manage client folders" ON public.client_drive_folders;

-- Create restrictive policy: only service role can access (no public/authenticated access)
-- Since edge functions use service_role key which bypasses RLS, we just need to deny all other access

-- Policy to deny all access to regular users (authenticated or anonymous)
-- By not having any permissive SELECT policy, no one can read the data except service role
CREATE POLICY "Only service role can access client folders"
ON public.client_drive_folders
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);