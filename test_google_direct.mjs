// Test direct Google Calendar API access to see the exact error
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bbdylrwiwnwjpeblxriq.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZHlscndpd253anBlYmx4cmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDMwNDUsImV4cCI6MjA5MDgxOTA0NX0.RDiv9VUPYox5AcauphJ_tMYx5D83otmroKCJH_dDTaU";
import crypto from "crypto";

async function main() {
  // Get the service account key from DB
  const supabase = createClient(SUPABASE_URL, ANON_KEY);
  const { data } = await supabase
    .from("studios")
    .select("google_calendar_id, google_service_account_key")
    .eq("name", "trap house")
    .single();

  if (!data?.google_service_account_key) {
    console.error("No service account key found");
    return;
  }

  const calendarId = data.google_calendar_id;
  const keyData = JSON.parse(data.google_service_account_key);
  
  console.log("Calendar ID:", calendarId);
  console.log("Service Account:", keyData.client_email);

  // Generate JWT for Google API
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const claimSet = Buffer.from(JSON.stringify({
    iss: keyData.client_email,
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  })).toString("base64url");

  const signInput = `${header}.${claimSet}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signInput);
  const signature = sign.sign(keyData.private_key, "base64url");
  const jwt = `${signInput}.${signature}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    console.error("Token error:", tokenData);
    return;
  }
  console.log("✅ Got access token");

  // Call Google Calendar API directly
  const calUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=2026-04-06T00:00:00Z&timeMax=2026-04-13T00:00:00Z&singleEvents=true&orderBy=startTime`;
  
  console.log("\nFetching events from:", calendarId);
  const calRes = await fetch(calUrl, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  
  console.log("Google Calendar API Status:", calRes.status);
  const calData = await calRes.json();
  
  if (calRes.ok) {
    console.log("Events found:", calData.items?.length || 0);
    if (calData.items) {
      for (const event of calData.items) {
        console.log(`  - ${event.summary || "(Sans titre)"}: ${event.start?.dateTime || event.start?.date} → ${event.end?.dateTime || event.end?.date}`);
      }
    }
  } else {
    console.error("Google API Error:", JSON.stringify(calData, null, 2));
  }
}

main().catch(console.error);
