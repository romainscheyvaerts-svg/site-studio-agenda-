const API_KEY = "sbp_3e9c5a04c8a35aba19390e3619a4a18baddc2230";
const PROJECT_ID = "bbdylrwiwnwjpeblxriq";
const SUPABASE_URL = "https://bbdylrwiwnwjpeblxriq.supabase.co";

async function main() {
  // Get service role key
  const keysRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/api-keys`, {
    headers: { Authorization: `Bearer ${API_KEY}` }
  });
  const keys = await keysRes.json();
  const SR = keys.find(k => k.name === "service_role").api_key;

  // Query policies via SQL
  const sql = `
    SELECT tablename, policyname, cmd, qual, with_check 
    FROM pg_policies 
    WHERE tablename IN ('studio_members','studios') 
    ORDER BY tablename, policyname
  `;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SR}`,
      apikey: SR,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "exec_sql", params: { query: sql } }),
  });

  // Fallback: query pg_policies directly via PostgREST
  const res2 = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SR}`,
      apikey: SR,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  // Try another approach - use the management API
  const sqlRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  
  const data = await sqlRes.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
