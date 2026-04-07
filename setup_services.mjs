import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres:Maison2323777%2C@db.bbdylrwiwnwjpeblxriq.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected');

  // Delete old wrong service
  await client.query("DELETE FROM services WHERE service_key = 'enregistrement'");
  console.log('Deleted old enregistrement service');

  // Delete ALL existing services first
  await client.query("DELETE FROM services");
  console.log('Cleared all services');

  // Insert 7 standard services
  const result = await client.query(`
    INSERT INTO services (service_key, name_fr, base_price, price_unit, is_active, sort_order)
    VALUES
      ('with-engineer', 'Avec Ingenieur', 45, '/h', true, 1),
      ('without-engineer', 'Location Seche', 22, '/h', true, 2),
      ('mixing', 'Mixage', 200, '/projet', true, 3),
      ('mastering', 'Mastering', 60, '/titre', true, 4),
      ('analog-mastering', 'Mastering Analogique', 100, '/titre', true, 5),
      ('podcast', 'Mixage Podcast', 40, '/min', true, 6),
      ('composition', 'Composition', 200, '/projet', true, 7)
  `);
  console.log('Inserted:', result.rowCount, 'services');

  // Verify
  const check = await client.query('SELECT service_key, name_fr, base_price, price_unit, is_active FROM services ORDER BY sort_order');
  console.log('\nServices in DB:');
  console.table(check.rows);

  await client.end();
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
