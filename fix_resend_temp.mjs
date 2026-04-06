import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres:Maison2323777%2C@db.bbdylrwiwnwjpeblxriq.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected');

  // Set onboarding@resend.dev as temporary from email (works without domain verification)
  const r = await client.query(`
    UPDATE studios 
    SET resend_from_email = 'onboarding@resend.dev'
    WHERE name = 'trap house'
    RETURNING name, resend_from_email
  `);
  
  console.log('Updated:', JSON.stringify(r.rows, null, 2));
  
  // Verify all studios
  const all = await client.query('SELECT name, resend_from_email, LEFT(resend_api_key, 12) as key_preview FROM studios');
  console.log('All studios:', JSON.stringify(all.rows, null, 2));
  
  await client.end();
}

run().catch(e => { console.error(e); process.exit(1); });
