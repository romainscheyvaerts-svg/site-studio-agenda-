import pg from 'pg';
const { Client } = pg;
const c = new Client({
  connectionString: 'postgresql://postgres:Maison2323777%2C@db.bbdylrwiwnwjpeblxriq.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

await c.connect();

// Check if table exists
const { rows } = await c.query("SELECT to_regclass('public.studio_events')");
console.log("Table exists:", rows[0].to_regclass);

if (!rows[0].to_regclass) {
  console.log("Creating table...");
  await c.query(`
    CREATE TABLE studio_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      client_name TEXT,
      client_email TEXT,
      service_type TEXT,
      total_price NUMERIC(10,2),
      event_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      duration_hours INTEGER DEFAULT 2,
      color_id TEXT DEFAULT '9',
      assigned_admin_id UUID,
      created_by UUID,
      status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending', 'cancelled')),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log("✅ Table created!");
  
  await c.query("CREATE INDEX idx_studio_events_studio_date ON studio_events(studio_id, event_date)");
  await c.query("ALTER TABLE studio_events ENABLE ROW LEVEL SECURITY");
  await c.query("CREATE POLICY studio_events_select_all ON studio_events FOR SELECT USING (true)");
  await c.query(`CREATE POLICY studio_events_insert_admin ON studio_events FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM studio_members sm WHERE sm.user_id = auth.uid() AND sm.studio_id = studio_events.studio_id AND sm.role IN ('owner', 'admin'))
    OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'superadmin'))
  )`);
  await c.query(`CREATE POLICY studio_events_update_admin ON studio_events FOR UPDATE USING (
    EXISTS (SELECT 1 FROM studio_members sm WHERE sm.user_id = auth.uid() AND sm.studio_id = studio_events.studio_id AND sm.role IN ('owner', 'admin'))
    OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'superadmin'))
  )`);
  await c.query(`CREATE POLICY studio_events_delete_admin ON studio_events FOR DELETE USING (
    EXISTS (SELECT 1 FROM studio_members sm WHERE sm.user_id = auth.uid() AND sm.studio_id = studio_events.studio_id AND sm.role IN ('owner', 'admin'))
    OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'superadmin'))
  )`);
  console.log("✅ RLS policies created!");
} else {
  console.log("Table already exists, checking columns...");
  const { rows: cols } = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='studio_events' ORDER BY ordinal_position");
  cols.forEach(r => console.log("  " + r.column_name));
}

// Notify PostgREST to reload schema
await c.query("NOTIFY pgrst, 'reload schema'");
console.log("✅ Schema reload notified");

await c.end();
