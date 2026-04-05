import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://postgres:Maison2323777%2C@db.bbdylrwiwnwjpeblxriq.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
async function run() {
  await client.connect();
  const res = await client.query('SELECT service_key, name_fr, base_price, is_active FROM services ORDER BY sort_order');
  console.table(res.rows);
  await client.end();
}
run();
