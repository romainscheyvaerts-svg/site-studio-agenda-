const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZHlscndpd253anBlYmx4cmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDMwNDUsImV4cCI6MjA5MDgxOTA0NX0.RDiv9VUPYox5AcauphJ_tMYx5D83otmroKCJH_dDTaU";

const res = await fetch("https://bbdylrwiwnwjpeblxriq.supabase.co/functions/v1/get-weekly-availability", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
  },
  body: JSON.stringify({ startDate: "2026-04-06", days: 7, studioId: null }),
});

console.log("Status:", res.status);
const text = await res.text();
console.log("Response:", text.substring(0, 1000));
