-- Admin profiles table for display name and color
CREATE TABLE IF NOT EXISTS admin_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#00D9FF', -- Default primary color
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Session assignments table to track who created and who is assigned to sessions
CREATE TABLE IF NOT EXISTS session_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL, -- Google Calendar event ID
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignment_token TEXT UNIQUE DEFAULT gen_random_uuid()::text, -- For email link assignment
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_profiles_user_id ON admin_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_session_assignments_event_id ON session_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_session_assignments_created_by ON session_assignments(created_by);
CREATE INDEX IF NOT EXISTS idx_session_assignments_assigned_to ON session_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_session_assignments_token ON session_assignments(assignment_token);

-- Enable RLS
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_profiles
CREATE POLICY "Admins can view all profiles" ON admin_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

CREATE POLICY "Users can update their own profile" ON admin_profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON admin_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for session_assignments
CREATE POLICY "Admins can view all assignments" ON session_assignments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

CREATE POLICY "Admins can insert assignments" ON session_assignments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

CREATE POLICY "Admins can update assignments" ON session_assignments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- Public read access for assignment by token (for email links)
CREATE POLICY "Anyone can view by token" ON session_assignments
  FOR SELECT USING (true);

-- Predefined colors for admins
COMMENT ON TABLE admin_profiles IS 'Available colors: #00D9FF (cyan), #FF6B6B (red), #4ECDC4 (teal), #FFE66D (yellow), #95E1D3 (mint), #F38181 (coral), #AA96DA (purple), #FCBAD3 (pink), #A8D8EA (light blue), #FF9F45 (orange)';