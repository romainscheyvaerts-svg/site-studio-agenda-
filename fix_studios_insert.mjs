const API_KEY = "sbp_3e9c5a04c8a35aba19390e3619a4a18baddc2230";
const PROJECT_ID = "bbdylrwiwnwjpeblxriq";
const SUPABASE_URL = "https://bbdylrwiwnwjpeblxriq.supabase.co";

async function getServiceRoleKey() {
  const keysRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/api-keys`, {
    headers: { Authorization: `Bearer ${API_KEY}` }
  });
  const keys = await keysRes.json();
  return keys.find(k => k.name === "service_role").api_key;
}

async function runSQL(SR, sql) {
  // Use Supabase Management API through postgres endpoint
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  
  if (res.ok) return await res.json();
  
  // Fallback: try with exec_sql RPC or direct PostgrestRPC
  const fallbackRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SR}`,
      apikey: SR,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({}),
  });
  return { fallback: await fallbackRes.text() };
}

async function main() {
  const SR = await getServiceRoleKey();
  console.log("Got service role key");

  // Use the management API directly with the correct endpoint
  const queries = [
    `DROP POLICY IF EXISTS "Authenticated users can create studios" ON public.studios`,
    `CREATE POLICY "Authenticated users can create studios" ON public.studios FOR INSERT TO authenticated WITH CHECK (true)`,
    `DROP POLICY IF EXISTS "Creator can see their new studio" ON public.studios`,
    `DROP POLICY IF EXISTS "Members can view their studio" ON public.studios`,
    `DROP POLICY IF EXISTS "Public can view active studios" ON public.studios`,
    `CREATE POLICY "Anyone can view studios" ON public.studios FOR SELECT USING (true)`,
  ];

  for (const sql of queries) {
    console.log(`\nRunning: ${sql.substring(0, 80)}...`);
    const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    });
    const data = await res.json();
    console.log("  Status:", res.status, JSON.stringify(data).substring(0, 200));
  }

  // Verify
  console.log("\n=== Final policies ===");
  const verifyRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: "SELECT policyname, cmd FROM pg_policies WHERE tablename = 'studios' ORDER BY policyname" }),
  });
  console.log(JSON.stringify(await verifyRes.json(), null, 2));
}

main().catch(console.error);
