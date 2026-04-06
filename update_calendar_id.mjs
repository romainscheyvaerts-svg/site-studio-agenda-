import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://bbdylrwiwnwjpeblxriq.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZHlscndpd253anBlYmx4cmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDMwNDUsImV4cCI6MjA5MDgxOTA0NX0.RDiv9VUPYox5AcauphJ_tMYx5D83otmroKCJH_dDTaU"
);

async function main() {
  const newCalendarId = "my.trap.house.bxl@gmail.com";
  
  console.log("Updating trap house Calendar ID to:", newCalendarId);
  
  const { data, error } = await supabase
    .from("studios")
    .update({ google_calendar_id: newCalendarId })
    .eq("name", "trap house")
    .select("id, name, google_calendar_id");
  
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("✅ Updated:", data);
  }
  
  // Test immediately
  console.log("\n=== Testing get-weekly-availability... ===");
  const studioId = data?.[0]?.id;
  if (studioId) {
    const res = await fetch("https://bbdylrwiwnwjpeblxriq.supabase.co/functions/v1/get-weekly-availability", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZHlscndpd253anBlYmx4cmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDMwNDUsImV4cCI6MjA5MDgxOTA0NX0.RDiv9VUPYox5AcauphJ_tMYx5D83otmroKCJH_dDTaU",
        Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZHlscndpd253anBlYmx4cmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDMwNDUsImV4cCI6MjA5MDgxOTA0NX0.RDiv9VUPYox5AcauphJ_tMYx5D83otmroKCJH_dDTaU"
      },
      body: JSON.stringify({ startDate: "2026-04-06", days: 7, studioId })
    });
    
    console.log("Status:", res.status);
    const json = await res.json();
    
    if (json.error) {
      console.error("API Error:", json.error);
    } else {
      let eventCount = 0;
      for (const day of (json.availability || [])) {
        for (const slot of day.slots) {
          if (slot.eventName) {
            eventCount++;
            console.log("  EVENT:", day.date, slot.hour + "h -", slot.eventName);
          }
        }
      }
      console.log("Total events:", eventCount);
      
      // Check specific slots
      const apr6 = json.availability?.find(d => d.date === "2026-04-06");
      if (apr6) {
        const slot14 = apr6.slots.find(s => s.hour === 14);
        console.log("\n6 avril 14h:", JSON.stringify(slot14));
      }
      const apr8 = json.availability?.find(d => d.date === "2026-04-08");
      if (apr8) {
        const slot14 = apr8.slots.find(s => s.hour === 14);
        console.log("8 avril 14h:", JSON.stringify(slot14));
      }
    }
  }
}

main().catch(console.error);
