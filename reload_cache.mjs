import pg from 'pg';
const { Client } = pg;
const c = new Client({
  connectionString: 'postgresql://postgres:Maison2323777%2C@db.bbdylrwiwnwjpeblxriq.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
await c.connect();
await c.query("NOTIFY pgrst, 'reload schema'");
console.log('✅ Schema cache reloaded');
await c.end();
