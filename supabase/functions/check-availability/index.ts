import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CalendarEvent {
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

interface CalendarResponse {
  items?: CalendarEvent[];
}

async function getAccessToken(serviceAccountKey: string): Promise<string> {
  const key = JSON.parse(serviceAccountKey);
  
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  
  const base64UrlEncode = (data: Uint8Array): string => {
    const base64 = btoa(String.fromCharCode(...data));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const claimB64 = base64UrlEncode(encoder.encode(JSON.stringify(claim)));
  const signatureInput = `${headerB64}.${claimB64}`;

  // Import private key
  const pemContents = key.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");
  
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(signatureInput)
  );

  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  const jwt = `${signatureInput}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResponse.json();
  
  if (!tokenData.access_token) {
    console.error("Token response:", tokenData);
    throw new Error("Failed to get access token");
  }
  
  return tokenData.access_token;
}

async function getCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");

  console.log(`Fetching events for calendar: ${calendarId}`);
  
  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Calendar API error for ${calendarId}:`, errorText);
    throw new Error(`Failed to fetch calendar events: ${response.status}`);
  }

  const data: CalendarResponse = await response.json();
  console.log(`Found ${data.items?.length || 0} events for ${calendarId}`);
  return data.items || [];
}

function hasOverlap(
  events: CalendarEvent[],
  requestedStart: Date,
  requestedEnd: Date
): boolean {
  for (const event of events) {
    const eventStart = new Date(event.start.dateTime || event.start.date || "");
    const eventEnd = new Date(event.end.dateTime || event.end.date || "");
    
    // Check for overlap: event starts before requested ends AND event ends after requested starts
    if (eventStart < requestedEnd && eventEnd > requestedStart) {
      console.log(`Overlap found: ${eventStart.toISOString()} - ${eventEnd.toISOString()}`);
      return true;
    }
  }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { date, time, duration, sessionType } = await req.json();
    
    console.log(`Checking availability for: ${date} at ${time}, duration: ${duration}h, type: ${sessionType}`);

    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    const patronCalendarId = Deno.env.get("GOOGLE_PATRON_CALENDAR_ID");
    const studioCalendarId = Deno.env.get("GOOGLE_STUDIO_CALENDAR_ID");

    if (!serviceAccountKey || !patronCalendarId || !studioCalendarId) {
      throw new Error("Missing calendar configuration");
    }

    // Parse date and time
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    
    const requestedStart = new Date(year, month - 1, day, hour, minute);
    const requestedEnd = new Date(requestedStart.getTime() + duration * 60 * 60 * 1000);

    // Get time range for the day (with buffer)
    const dayStart = new Date(year, month - 1, day, 0, 0).toISOString();
    const dayEnd = new Date(year, month - 1, day, 23, 59).toISOString();

    const accessToken = await getAccessToken(serviceAccountKey);

    // Fetch events from both calendars
    const [patronEvents, studioEvents] = await Promise.all([
      getCalendarEvents(accessToken, patronCalendarId, dayStart, dayEnd),
      getCalendarEvents(accessToken, studioCalendarId, dayStart, dayEnd),
    ]);

    let isAvailable = false;
    let message = "";

    if (sessionType === "with-engineer") {
      // WITH Engineer: Check patron first, then studio (assistant)
      const patronBusy = hasOverlap(patronEvents, requestedStart, requestedEnd);
      
      if (!patronBusy) {
        isAvailable = true;
        message = "Le patron est disponible pour votre session.";
      } else {
        // Check if assistant (studio calendar) is available
        const studioBusy = hasOverlap(studioEvents, requestedStart, requestedEnd);
        if (!studioBusy) {
          isAvailable = true;
          message = "L'assistant sera disponible pour votre session.";
        } else {
          isAvailable = false;
          message = "Désolé, aucun ingénieur n'est disponible à ce créneau.";
        }
      }
    } else if (sessionType === "without-engineer") {
      // WITHOUT Engineer: Both must be free (solo access)
      const patronBusy = hasOverlap(patronEvents, requestedStart, requestedEnd);
      const studioBusy = hasOverlap(studioEvents, requestedStart, requestedEnd);
      
      if (!patronBusy && !studioBusy) {
        isAvailable = true;
        message = "Le studio est disponible pour votre session en autonomie.";
      } else {
        isAvailable = false;
        message = "Désolé, le studio n'est pas disponible à ce créneau (un membre du staff sera présent).";
      }
    } else {
      // Mixing/Mastering - always available (async work)
      isAvailable = true;
      message = "Votre demande de mixage/mastering peut être traitée.";
    }

    console.log(`Availability result: ${isAvailable} - ${message}`);

    return new Response(
      JSON.stringify({ available: isAvailable, message }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error checking availability:", errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage, available: false }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
