import pg from 'pg';
const { Client } = pg;
const c = new Client({
  connectionString: 'postgresql://postgres:Maison2323777%2C@db.bbdylrwiwnwjpeblxriq.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

await c.connect();
console.log('✅ Connected');

// Check columns
const res = await c.query(`
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'studios' AND column_name IN ('font_family', 'hero_title_line1', 'show_pricing', 'navbar_style')
  ORDER BY column_name
`);
console.log('📋 Design columns found:', res.rows.map(r => r.column_name));

if (res.rows.length === 0) {
  console.log('❌ No design columns found! Running migration...');
  const statements = [
    "ALTER TABLE studios ADD COLUMN IF NOT EXISTS hero_title_line1 TEXT DEFAULT NULL",
    "ALTER TABLE studios ADD COLUMN IF NOT EXISTS hero_title_line2 TEXT DEFAULT NULL",
    "ALTER TABLE studios ADD COLUMN IF NOT EXISTS hero_subtitle TEXT DEFAULT NULL",
    "ALTER TABLE studios ADD COLUMN IF NOT EXISTS hero_image_url TEXT DEFAULT NULL",
    "ALTER TABLE studios ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT NULL",
    "ALTER TABLE studios ADD COLUMN IF NOT EXISTS show_pricing BOOLEAN DEFAULT true",
    "ALTER TABLE studios ADD COLUMN IF NOT EXISTS show_instrumentals BOOLEAN DEFAULT true",
    "ALTER TABLE studios ADD COLUMN IF NOT EXISTS show_gallery BOOLEAN DEFAULT true",
    "ALTER TABLE studios ADD COLUMN IF NOT EXISTS show_chatbot BOOLEAN DEFAULT true",
    "ALTER TABLE studios ADD COLUMN IF NOT EXISTS show_gear BOOLEAN DEFAULT true",
    "ALTER TABLE studios ADD COLUMN IF NOT EXISTS show_booking BOOLEAN DEFAULT true",
    "ALTER TABLE studios ADD COLUMN IF NOT EXISTS font_family TEXT DEFAULT 'Inter'",
    "ALTER TABLE studios ADD COLUMN IF NOT EXISTS social_instagram TEXT DEFAULT NULL",
    "ALTER TABLE studios ADD COLUMN IF NOT EXISTS social_facebook TEXT DEFAULT NULL",
    "ALTER TABLE studios ADD COLUMN IF NOT EXISTS social_tiktok TEXT DEFAULT NULL",
    "ALTER TABLE studios ADD COLUMN IF NOT EXISTS social_youtube TEXT DEFAULT NULL",
    "ALTER TABLE studios ADD COLUMN IF NOT EXISTS social_spotify TEXT DEFAULT NULL",
    "ALTER TABLE studios ADD COLUMN IF NOT EXISTS social_website TEXT DEFAULT NULL",
    "ALTER TABLE studios ADD COLUMN IF NOT EXISTS footer_text TEXT DEFAULT NULL",
    "ALTER TABLE studios ADD COLUMN IF NOT EXISTS navbar_style TEXT DEFAULT 'transparent'"
  ];
  for (const stmt of statements) {
    try { await c.query(stmt); } catch(e) { console.log('  skip:', e.message); }
  }
  console.log('✅ Migration done');
}

// Force PostgREST reload
await c.query("NOTIFY pgrst, 'reload schema'");
console.log('✅ Schema cache reload sent');

// Also try pg_notify function
try {
  await c.query("SELECT pg_notify('pgrst', 'reload schema')");
  console.log('✅ pg_notify sent');
} catch(e) {
  console.log('pg_notify error:', e.message);
}

// Double check
const res2 = await c.query(`
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'studios' AND table_schema = 'public'
  AND column_name LIKE 'font%' OR column_name LIKE 'hero%' OR column_name LIKE 'show%' OR column_name LIKE 'social%' OR column_name LIKE 'navbar%' OR column_name LIKE 'footer%'
  ORDER BY column_name
`);
console.log('📋 All design columns:', res2.rows.map(r => r.column_name));

await c.end();
