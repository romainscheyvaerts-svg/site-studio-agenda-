// Revert resend_from_email back to onboarding@resend.dev (temporary until domain is verified)
const SUPABASE_TOKEN = "sbp_a54cf563e1fc4b0356a831b26eaecfe090be9b6e";
const PROJECT_ID = "bbdylrwiwnwjpeblxriq";

const sql = `UPDATE studios SET resend_from_email = 'onboarding@resend.dev' WHERE slug = 'trap-house' RETURNING slug, resend_from_email;`;

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${SUPABASE_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});

const data = await res.json();
console.log("Result:", JSON.stringify(data, null, 2));
