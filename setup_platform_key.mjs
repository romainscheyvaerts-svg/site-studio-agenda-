// Extract service account key from trap house studio and set as platform secret
import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";

const SUPABASE_URL = "https://bbdylrwiwnwjpeblxriq.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZHlscndpd253anBlYmx4cmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDMwNDUsImV4cCI6MjA5MDgxOTA0NX0.RDiv9VUPYox5AcauphJ_tMYx5D83otmroKCJH_dDTaU";

async function main() {
  const supabase = createClient(SUPABASE_URL, ANON_KEY);
  
  // Get the service account key from trap house studio
  const { data, error } = await supabase
    .from("studios")
    .select("google_service_account_key")
    .eq("name", "trap house")
    .single();
  
  if (error || !data?.google_service_account_key) {
    console.error("Could not get service account key:", error);
    return;
  }

  const key = data.google_service_account_key;
  const parsed = JSON.parse(key);
  console.log("Service account email:", parsed.client_email);
  
  // Write to temp file for the secret command (avoiding shell escaping issues)
  const escapedKey = key.replace(/\n/g, "\\n");
  writeFileSync("_temp_secret.txt", `GOOGLE_SERVICE_ACCOUNT_KEY=${escapedKey}`);
  
  console.log("Setting GOOGLE_SERVICE_ACCOUNT_KEY as Supabase secret...");
  try {
    const result = execSync(
      `npx supabase secrets set --project-ref bbdylrwiwnwjpeblxriq --env-file _temp_secret.txt`,
      { encoding: "utf-8", timeout: 30000 }
    );
    console.log("Result:", result);
    console.log("✅ Secret set successfully!");
  } catch (e) {
    console.error("Error setting secret:", e.message);
  } finally {
    try { unlinkSync("_temp_secret.txt"); } catch {}
  }
}

main();
