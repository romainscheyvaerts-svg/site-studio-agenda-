// Test if PostgREST sees the font_family column
const url = "https://bbdylrwiwnwjpeblxriq.supabase.co/rest/v1/studios?select=id,name,font_family,hero_title_line1&limit=1";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZHlscndpd253anBlYmx4cmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDMwNDUsImV4cCI6MjA5MDgxOTA0NX0.RDiv9VUPYox5AcauphJ_tMYx5D83otmroKCJH_dDTaU";

const res = await fetch(url, {
  headers: { apikey: key, Authorization: `Bearer ${key}` }
});
const text = await res.text();
console.log('Status:', res.status);
console.log('Response:', text);
