import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://bbdylrwiwnwjpeblxriq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZHlscndpd253anBlYmx4cmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDMwNDUsImV4cCI6MjA5MDgxOTA0NX0.RDiv9VUPYox5AcauphJ_tMYx5D83otmroKCJH_dDTaU'
);

// First sign in as admin to get a valid session
const email = process.argv[2] || 'my.trap.house.bxl@gmail.com';
const password = process.argv[3] || '';

if (!password) {
  console.log('Usage: node test_email.mjs <admin_email> <admin_password>');
  console.log('');
  console.log('This will sign in as admin and send a test email via the send-admin-email function.');
  
  // Let's just check the studio config instead
  console.log('\n--- Checking studio config ---');
  
  const pg = await import('pg');
  const client = new pg.default.Client({
    connectionString: 'postgresql://postgres:Maison2323777%2C@db.bbdylrwiwnwjpeblxriq.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  
  const result = await client.query(`
    SELECT id, name, email, phone, resend_from_email, 
           CASE WHEN resend_api_key IS NOT NULL AND resend_api_key != '' THEN 'SET' ELSE 'NOT SET' END as resend_key,
           email_greeting, email_noreply_text, email_show_phone, email_show_google_calendar
    FROM studios WHERE name = 'trap house'
  `);
  
  console.log(JSON.stringify(result.rows[0], null, 2));
  
  // Check if Resend integration added any secrets
  console.log('\n--- Checking Supabase secrets (env vars available to Edge Functions) ---');
  console.log('The Edge Function has access to RESEND_API_KEY from Supabase integration.');
  console.log('Current from_email:', result.rows[0]?.resend_from_email);
  
  await client.end();
  process.exit(0);
}

// Sign in
const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError) {
  console.error('Auth error:', authError.message);
  process.exit(1);
}

console.log('Signed in as:', authData.user.email);
const token = authData.session.access_token;

// Get studio ID
const pg2 = await import('pg');
const client2 = new pg2.default.Client({
  connectionString: 'postgresql://postgres:Maison2323777%2C@db.bbdylrwiwnwjpeblxriq.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
await client2.connect();
const studioResult = await client2.query(`SELECT id FROM studios WHERE name = 'trap house'`);
const studioId = studioResult.rows[0]?.id;
await client2.end();

console.log('Studio ID:', studioId);

// Call the Edge Function
const response = await fetch('https://bbdylrwiwnwjpeblxriq.supabase.co/functions/v1/send-admin-email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    clientEmail: 'my.trap.house.bxl@gmail.com',
    clientName: 'Test Client',
    sessionType: 'with-engineer',
    sessionDate: '2026-04-10',
    sessionTime: '14:00',
    hours: 2,
    totalPrice: 150,
    studioId: studioId,
  }),
});

const result2 = await response.json();
console.log('Response status:', response.status);
console.log('Response:', JSON.stringify(result2, null, 2));
