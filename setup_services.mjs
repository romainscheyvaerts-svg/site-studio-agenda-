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

  // Restore owner's original service: test at 0€
  const result = await client.query(`
    INSERT INTO services (service_key, name_fr, base_price, price_unit, is_active, sort_order)
    VALUES
      ('test', 'test', 0, '/h', true, 1)
  `);
  console.log('Inserted:', result.rowCount, 'services');

  // Verify
  const check = await client.query('SELECT service_key, name_fr, base_price, price_unit, is_active FROM services ORDER BY sort_order');
  console.log('\nServices in DB:');
  console.table(check.rows);

  await client.end();
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
