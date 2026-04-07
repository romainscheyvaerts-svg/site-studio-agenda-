import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres:Maison2323777%2C@db.bbdylrwiwnwjpeblxriq.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected');

  // 1. Add new columns to services table for dynamic booking flow
  const alterQueries = [
    `ALTER TABLE services ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'studio'`,
    `ALTER TABLE services ADD COLUMN IF NOT EXISTS requires_calendar BOOLEAN DEFAULT true`,
    `ALTER TABLE services ADD COLUMN IF NOT EXISTS requires_identity BOOLEAN DEFAULT true`,
    `ALTER TABLE services ADD COLUMN IF NOT EXISTS deposit_type TEXT DEFAULT 'half'`, // full, half, fixed, none
    `ALTER TABLE services ADD COLUMN IF NOT EXISTS deposit_fixed_amount NUMERIC DEFAULT 0`,
    `ALTER TABLE services ADD COLUMN IF NOT EXISTS description_fr TEXT DEFAULT ''`,
    `ALTER TABLE services ADD COLUMN IF NOT EXISTS icon_name TEXT DEFAULT 'Mic'`,
    `ALTER TABLE services ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'primary'`, // primary, accent, pink, green, etc.
  ];

  for (const q of alterQueries) {
    try {
      await client.query(q);
      console.log('OK:', q.substring(0, 80));
    } catch (e) {
      console.log('Skip (already exists?):', e.message.substring(0, 80));
    }
  }

  // 2. Delete all services and restore only the owner's "test" service
  await client.query("DELETE FROM services");
  console.log('\nCleared all services');

  // Insert owner's test service
  await client.query(`
    INSERT INTO services (service_key, name_fr, base_price, price_unit, is_active, sort_order, 
                          category, requires_calendar, requires_identity, deposit_type, deposit_fixed_amount, 
                          description_fr, icon_name, color)
    VALUES
      ('test', 'test', 0, '/h', true, 1, 
       'studio', true, false, 'none', 0, 
       'Service de test', 'Mic', 'primary')
  `);
  console.log('Inserted owner test service');

  // 3. Verify
  const check = await client.query('SELECT service_key, name_fr, base_price, price_unit, is_active, category, requires_calendar, requires_identity, deposit_type, icon_name, color FROM services ORDER BY sort_order');
  console.log('\nServices in DB:');
  console.table(check.rows);

  await client.end();
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });