import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://bbdylrwiwnwjpeblxriq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZHlscndpd253anBlYmx4cmlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI0MzA0NSwiZXhwIjoyMDkwODE5MDQ1fQ.RDiv9VUPYox5AcauphJ_tMYx5D83otmroKCJH_dDTaU',
);

async function fixResendFromEmail() {
  // 1. Check current from email
  const { data: studios, error } = await supabase
    .from('studios')
    .select('id, name, resend_from_email, resend_api_key, email')
    .limit(10);

  if (error) {
    console.error('Error fetching studios:', error);
    return;
  }

  console.log('Current studios config:');
  studios?.forEach(s => {
    console.log(`  Studio: ${s.name}`);
    console.log(`    email: ${s.email}`);
    console.log(`    resend_from_email: ${s.resend_from_email}`);
    console.log(`    resend_api_key: ${s.resend_api_key ? '✅ SET (' + s.resend_api_key.substring(0, 10) + '...)' : '❌ NOT SET'}`);
  });

  // 2. Fix: update gmail addresses to use the verified Resend domain
  for (const studio of studios || []) {
    if (studio.resend_from_email && studio.resend_from_email.includes('gmail.com')) {
      const newFromEmail = `noreply@my.trap.house.bxl`;
      console.log(`\n⚠️  Fixing "${studio.name}" from email:`);
      console.log(`   OLD: ${studio.resend_from_email} (Gmail - Resend CANNOT send from this)`);
      console.log(`   NEW: ${newFromEmail} (verified Resend domain)`);

      const { error: updateError } = await supabase
        .from('studios')
        .update({ resend_from_email: newFromEmail })
        .eq('id', studio.id);

      if (updateError) {
        console.error('   ❌ Update error:', updateError);
      } else {
        console.log('   ✅ Updated successfully!');
      }
    }
  }

  // 3. Verify
  const { data: updated } = await supabase
    .from('studios')
    .select('id, name, resend_from_email')
    .limit(10);

  console.log('\nVerification:');
  updated?.forEach(s => {
    console.log(`  ${s.name}: resend_from_email = ${s.resend_from_email}`);
  });
}

fixResendFromEmail();
