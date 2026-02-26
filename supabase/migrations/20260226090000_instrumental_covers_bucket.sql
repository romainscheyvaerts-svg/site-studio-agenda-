-- Create storage bucket for instrumental covers
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'instrumental-covers',
  'instrumental-covers',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Policy to allow authenticated users (admins) to upload
CREATE POLICY "Admins can upload covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'instrumental-covers');

-- Policy to allow public read access
CREATE POLICY "Public can view covers"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'instrumental-covers');

-- Policy to allow authenticated users to update/delete their uploads
CREATE POLICY "Admins can update covers"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'instrumental-covers')
WITH CHECK (bucket_id = 'instrumental-covers');

CREATE POLICY "Admins can delete covers"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'instrumental-covers');
