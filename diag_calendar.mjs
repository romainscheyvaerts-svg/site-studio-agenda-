// Diagnostic: vérifier pourquoi les événements Google Calendar ne s'affichent pas
const SUPABASE_URL = "https://bbdylrwiwnwjpeblxriq.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZHlscndpd253anBlYmx4cmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDMwNDUsImV4cCI6MjA5MDgxOTA0NX0.RDiv9VUPYox5AcauphJ_tMYx5D83otmroKCJH_dDTaU";

async function main() {
  // 1. Récupérer les studios
  const res = await fetch(`${SUPABASE_URL}/rest/v1/studios?select=id,name,google_calendar_id,google_service_account_key`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` }
  });
  const studios = await res.json();
  
  console.log("=== STUDIOS ===");
  for (const s of studios) {
    console.log(`Studio: ${s.name}`);
    console.log(`  Calendar ID: ${s.google_calendar_id || 'NON CONFIGURÉ'}`);
    console.log(`  Service Key: ${s.google_service_account_key ? 'OUI' : 'NON'}`);
    
    if (s.google_service_account_key) {
      try {
        const key = JSON.parse(s.google_service_account_key);
        console.log(`  Service Account Email: ${key.client_email}`);
      } catch(e) {
        console.log(`  Service Key INVALIDE: ${e.message}`);
      }
    }
  }

  // 2. Tester l'API get-weekly-availability pour le studio "trap house"
  const trapHouse = studios.find(s => s.name === "trap house");
  if (trapHouse) {
    console.log("\n=== TEST GET-WEEKLY-AVAILABILITY (trap house) ===");
    const avRes = await fetch(`${SUPABASE_URL}/functions/v1/get-weekly-availability`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`
      },
      body: JSON.stringify({
        startDate: "2026-04-06",
        days: 7,
        studioId: trapHouse.id
      })
    });
    
    console.log("Status:", avRes.status);
    const avData = await avRes.json();
    
    // Check for events
    let eventCount = 0;
    for (const day of (avData.availability || [])) {
      for (const slot of day.slots) {
        if (slot.eventName) {
          eventCount++;
          console.log(`  EVENT: ${day.date} ${slot.hour}h - ${slot.eventName} (id: ${slot.eventId})`);
        }
      }
    }
    console.log(`Total events found: ${eventCount}`);
    
    // Show April 6 slots status
    const apr6 = (avData.availability || []).find(d => d.date === "2026-04-06");
    if (apr6) {
      console.log("\n=== SLOTS 6 AVRIL (13h-16h) ===");
      for (const slot of apr6.slots.filter(s => s.hour >= 13 && s.hour <= 16)) {
        console.log(`  ${slot.hour}h: status=${slot.status}, available=${slot.available}, eventName=${slot.eventName || 'none'}`);
      }
    }
    
    // Show April 8 slots status
    const apr8 = (avData.availability || []).find(d => d.date === "2026-04-08");
    if (apr8) {
      console.log("\n=== SLOTS 8 AVRIL (13h-16h) ===");
      for (const slot of apr8.slots.filter(s => s.hour >= 13 && s.hour <= 16)) {
        console.log(`  ${slot.hour}h: status=${slot.status}, available=${slot.available}, eventName=${slot.eventName || 'none'}`);
      }
    }
  }
  
  // 3. Vérifier aussi le premier studio
  const makeMusic = studios.find(s => s.name === "studiomakemusic");
  if (makeMusic && makeMusic.google_calendar_id) {
    console.log("\n=== TEST GET-WEEKLY-AVAILABILITY (studiomakemusic) ===");
    const avRes2 = await fetch(`${SUPABASE_URL}/functions/v1/get-weekly-availability`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`
      },
      body: JSON.stringify({
        startDate: "2026-04-06",
        days: 7,
        studioId: makeMusic.id
      })
    });
    console.log("Status:", avRes2.status);
    const text = await avRes2.text();
    console.log("Response:", text.substring(0, 500));
  } else {
    console.log("\n=== studiomakemusic: PAS DE CALENDAR CONFIGURÉ ===");
  }
}

main().catch(console.error);
