-- Create table to store client Drive folders
CREATE TABLE public.client_drive_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  client_name TEXT NOT NULL,
  drive_folder_id TEXT NOT NULL,
  drive_folder_link TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_email)
);

-- Enable Row Level Security
ALTER TABLE public.client_drive_folders ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access only (edge functions)
CREATE POLICY "Service role can manage client folders"
ON public.client_drive_folders
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_client_drive_folders_email ON public.client_drive_folders(client_email);
CREATE INDEX idx_client_drive_folders_phone ON public.client_drive_folders(client_phone);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_client_drive_folders_updated_at
BEFORE UPDATE ON public.client_drive_folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();