-- Drop the existing restrictive policy that blocks everything
DROP POLICY IF EXISTS "Only service role can access client folders" ON public.client_drive_folders;

-- Create policy to allow authenticated users to see only their own folders (based on email match)
CREATE POLICY "Users can view their own drive folders"
ON public.client_drive_folders
FOR SELECT
TO authenticated
USING (client_email = auth.jwt() ->> 'email');

-- Block all anonymous access
CREATE POLICY "Deny anonymous access"
ON public.client_drive_folders
FOR SELECT
TO anon
USING (false);

-- Allow service role to insert (for edge functions creating folders)
CREATE POLICY "Service role can insert folders"
ON public.client_drive_folders
FOR INSERT
TO service_role
WITH CHECK (true);

-- Allow service role to update folders
CREATE POLICY "Service role can update folders"
ON public.client_drive_folders
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Allow service role to select (for edge functions checking existing folders)
CREATE POLICY "Service role can select folders"
ON public.client_drive_folders
FOR SELECT
TO service_role
USING (true);