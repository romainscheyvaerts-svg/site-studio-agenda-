import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres:Maison2323777%2C@db.bbdylrwiwnwjpeblxriq.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to DB');

  // Check current state
  const result = await client.query(`
    SELECT id, name, resend_from_email, 
           CASE WHEN resend_api_key IS NOT NULL AND resend_api_key != '' 
                THEN 'SET (' || LEFT(resend_api_key, 12) || '...)' 
                ELSE 'NOT SET' END as key_status
    FROM studios
  `);
  
  console.log('\nCurrent studios config:');
  for (const row of result.rows) {
    console.log(`  ${row.name}: from_email=${row.resend_from_email}, key=${row.key_status}`);
  }

  // Fix gmail from_email -> verified Resend domain
  const updateResult = await client.query(`
    UPDATE studios 
    SET resend_from_email = 'noreply@my.trap.house.bxl'
    WHERE resend_from_email LIKE '%gmail.com%' 
       OR resend_from_email LIKE '%hotmail%' 
       OR resend_from_email LIKE '%yahoo%'
    RETURNING id, name, resend_from_email
  `);

  if (updateResult.rowCount > 0) {
    console.log(`\n✅ Updated ${updateResult.rowCount} studio(s):`);
    for (const row of updateResult.rows) {
      console.log(`  ${row.name} -> resend_from_email = ${row.resend_from_email}`);
    }
  } else {
    console.log('\nNo studios with gmail from_email found. Checking if already correct...');
    const check = await client.query(`SELECT name, resend_from_email FROM studios`);
    for (const row of check.rows) {
      console.log(`  ${row.name}: ${row.resend_from_email}`);
    }
  }

  await client.end();
}

run().catch(e => { console.error(e); process.exit(1); });
