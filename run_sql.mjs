import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres:Maison2323777%2C@db.bbdylrwiwnwjpeblxriq.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const sqlFile = process.argv[2];
  if (!sqlFile) {
    console.error('Usage: node run_sql.mjs <fichier.sql>');
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlFile, 'utf8');
  
  // Split SQL into individual statements
  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  try {
    await client.connect();
    console.log('✅ Connecté à Supabase PostgreSQL');
    console.log(`⏳ Exécution de ${sqlFile} (${statements.length} instructions)...\n`);
    
    let success = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await client.query(stmt);
        success++;
      } catch (err) {
        if (err.message.includes('already exists') || err.message.includes('duplicate key') || err.message.includes('does not exist')) {
          skipped++;
        } else {
          errors++;
          console.error(`  ❌ Erreur instruction ${i + 1}: ${err.message}`);
          // Show first 80 chars of the failing statement
          console.error(`     SQL: ${stmt.substring(0, 80)}...`);
        }
      }
    }

    console.log(`\n✅ Terminé: ${success} réussies, ${skipped} ignorées (déjà existant), ${errors} erreurs`);
    
  } catch (err) {
    console.error('❌ Erreur connexion:', err.message);
  } finally {
    await client.end();
  }
}

run();
