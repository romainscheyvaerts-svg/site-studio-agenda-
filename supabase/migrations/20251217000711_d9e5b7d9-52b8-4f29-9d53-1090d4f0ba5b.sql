-- Create activity_logs table for tracking user/visitor actions
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  country text,
  action text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  path text,
  user_agent text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create blocked_ips table for IP blocking
CREATE TABLE public.blocked_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL UNIQUE,
  reason text,
  blocked_by text NOT NULL,
  blocked_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;

-- Admin policies for activity_logs
CREATE POLICY "Admins can view activity logs" ON public.activity_logs
  FOR SELECT USING (is_admin_email((auth.jwt() ->> 'email'::text)));

CREATE POLICY "Service role can insert activity logs" ON public.activity_logs
  FOR INSERT WITH CHECK (true);

-- Admin policies for blocked_ips
CREATE POLICY "Admins can manage blocked IPs" ON public.blocked_ips
  FOR ALL USING (is_admin_email((auth.jwt() ->> 'email'::text)));

-- Create index for faster queries
CREATE INDEX idx_activity_logs_ip ON public.activity_logs(ip_address);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_blocked_ips_ip ON public.blocked_ips(ip_address);