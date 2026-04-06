import pg from 'pg';
const { Client } = pg;
const c = new Client({
  connectionString: 'postgresql://postgres:Maison2323777%2C@db.bbdylrwiwnwjpeblxriq.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

await c.connect();

// List tables
const { rows: tables } = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
console.log("=== TABLES ===");
tables.forEach(r => console.log("  " + r.table_name));

// Check if studio_events exists
const hasEvents = tables.some(r => r.table_name === 'studio_events');
console.log("\nstudio_events exists:", hasEvents);

// Check bookings table
const hasBookings = tables.some(r => r.table_name === 'bookings');
if (hasBookings) {
  const { rows: cols } = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='bookings' ORDER BY ordinal_position");
  console.log("\n=== BOOKINGS COLUMNS ===");
  cols.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
}

await c.end();
