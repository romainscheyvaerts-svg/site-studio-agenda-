import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const availabilitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  duration: z.number().int().min(1).max(12),
  sessionType: z.enum(["with-engineer", "without-engineer", "mixing", "mastering", "analog-mastering", "podcast"]),
});

interface CalendarEvent {
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

interface CalendarResponse {
  items?: CalendarEvent[];
}

interface ICalEvent {
  start: Date;
  end: Date;
  isAllDay: boolean;
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

// Parse iCal date format (YYYYMMDD or YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ)
function parseICalDate(dateStr: string): Date {
  const cleanStr = dateStr.replace(/Z$/, "");
  
  if (cleanStr.includes("T")) {
    const year = parseInt(cleanStr.substring(0, 4));
    const month = parseInt(cleanStr.substring(4, 6)) - 1;
    const day = parseInt(cleanStr.substring(6, 8));
    const hour = parseInt(cleanStr.substring(9, 11));
    const minute = parseInt(cleanStr.substring(11, 13));
    const second = parseInt(cleanStr.substring(13, 15)) || 0;
    return new Date(year, month, day, hour, minute, second);
  } else {
    const year = parseInt(cleanStr.substring(0, 4));
    const month = parseInt(cleanStr.substring(4, 6)) - 1;
    const day = parseInt(cleanStr.substring(6, 8));
    return new Date(year, month, day);
  }
}

// Fetch and parse iCal from webcal URL
async function fetchICalEvents(icalUrl: string, startDate: Date, endDate: Date): Promise<ICalEvent[]> {
  try {
    const httpsUrl = icalUrl.replace("webcal://", "https://");
    console.log(`Fetching iCal from: ${httpsUrl}`);
    
    const response = await fetch(httpsUrl);
    if (!response.ok) {
      console.error(`Failed to fetch iCal: ${response.status}`);
      return [];
    }
    
    const icalData = await response.text();
    const events: ICalEvent[] = [];
    
    const eventBlocks = icalData.split("BEGIN:VEVENT");
    
    for (let i = 1; i < eventBlocks.length; i++) {
      const block = eventBlocks[i].split("END:VEVENT")[0];
      
      let dtstart = "";
      let dtend = "";
      let isAllDay = false;
      
      const lines = block.split(/\r?\n/);
      for (const line of lines) {
        if (line.startsWith("DTSTART")) {
          if (line.includes("VALUE=DATE:") || (!line.includes("T") && line.match(/:\d{8}$/))) {
            isAllDay = true;
          }
          const match = line.match(/:(\d{8}(?:T\d{6}Z?)?)/);
          if (match) {
            dtstart = match[1];
          }
        } else if (line.startsWith("DTEND")) {
          const match = line.match(/:(\d{8}(?:T\d{6}Z?)?)/);
          if (match) {
            dtend = match[1];
          }
        }
      }
      
      if (dtstart) {
        const eventStart = parseICalDate(dtstart);
        const eventEnd = dtend ? parseICalDate(dtend) : new Date(eventStart.getTime() + 3600000);
        
        if (eventEnd >= startDate && eventStart <= endDate) {
          events.push({ start: eventStart, end: eventEnd, isAllDay });
        }
      }
    }
    
    console.log(`Parsed ${events.length} iCal events`);
    return events;
  } catch (error) {
    console.error("Error fetching iCal:", error);
    return [];
  }
}

function hasOverlap(
  events: CalendarEvent[],
  requestedStart: Date,
  requestedEnd: Date
): boolean {
  for (const event of events) {
    const eventStart = new Date(event.start.dateTime || event.start.date || "");
    const eventEnd = new Date(event.end.dateTime || event.end.date || "");
    
    if (eventStart < requestedEnd && eventEnd > requestedStart) {
      console.log(`Overlap found: ${eventStart.toISOString()} - ${eventEnd.toISOString()}`);
      return true;
    }
  }
  return false;
}

function hasICalOverlap(
  events: ICalEvent[],
  requestedStart: Date,
  requestedEnd: Date
): boolean {
  for (const event of events) {
    if (event.isAllDay) {
      const eventDate = event.start.toISOString().split("T")[0];
      const requestedDate = requestedStart.toISOString().split("T")[0];
      if (eventDate === requestedDate) {
        return true;
      }
    }
    
    if (event.start < requestedEnd && event.end > requestedStart) {
      console.log(`iCal overlap found: ${event.start.toISOString()} - ${event.end.toISOString()}`);
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
    const rawBody = await req.json();
    
    // Validate input
    const parseResult = availabilitySchema.safeParse(rawBody);
    if (!parseResult.success) {
      console.error("[VALIDATION] Invalid input:", parseResult.error.errors);
      return new Response(
        JSON.stringify({ 
          error: "Invalid input", 
          details: parseResult.error.errors.map(e => e.message),
          available: false 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const { date, time, duration, sessionType } = parseResult.data;
    
    console.log(`Checking availability for: ${date} at ${time}, duration: ${duration}h, type: ${sessionType}`);

    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    const patronCalendarId = Deno.env.get("GOOGLE_PATRON_CALENDAR_ID");
    const studioCalendarId = Deno.env.get("GOOGLE_STUDIO_CALENDAR_ID");
    const claridgeIcalUrl = Deno.env.get("CLARIDGE_ICAL_URL");

    if (!serviceAccountKey || !patronCalendarId || !studioCalendarId) {
      throw new Error("Missing calendar configuration");
    }

    // Parse date and time
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    
    const requestedStart = new Date(year, month - 1, day, hour, minute);
    const requestedEnd = new Date(requestedStart.getTime() + duration * 60 * 60 * 1000);

    // Get time range for the day (with buffer)
    const dayStart = new Date(year, month - 1, day, 0, 0);
    const dayEnd = new Date(year, month - 1, day, 23, 59);

    const accessToken = await getAccessToken(serviceAccountKey);

    // Fetch events from all calendars
    const [patronEvents, studioEvents, claridgeEvents] = await Promise.all([
      getCalendarEvents(accessToken, patronCalendarId, dayStart.toISOString(), dayEnd.toISOString()),
      getCalendarEvents(accessToken, studioCalendarId, dayStart.toISOString(), dayEnd.toISOString()),
      claridgeIcalUrl ? fetchICalEvents(claridgeIcalUrl, dayStart, dayEnd) : Promise.resolve([]),
    ]);

    let isAvailable = false;
    let message = "";
    let status: "available" | "unavailable" | "on-request" = "unavailable";

    if (sessionType === "with-engineer" || sessionType === "without-engineer") {
      // Check main studio calendars
      const patronBusy = hasOverlap(patronEvents, requestedStart, requestedEnd);
      const studioBusy = hasOverlap(studioEvents, requestedStart, requestedEnd);
      
      if (!patronBusy && !studioBusy) {
        // Studio is available, now check Claridge calendar
        const claridgeBusy = hasICalOverlap(claridgeEvents, requestedStart, requestedEnd);
        
        if (claridgeBusy) {
          // Patron busy in Claridge but studio is free - on request
          isAvailable = true;
          status = "on-request";
          message = "Ce créneau est sur demande. Veuillez contacter le studio via WhatsApp pour vérifier la disponibilité.";
        } else {
          // Fully available
          isAvailable = true;
          status = "available";
          message = "Ce créneau est disponible.";
        }
      } else {
        isAvailable = false;
        status = "unavailable";
        message = "Désolé, ce créneau n'est pas disponible.";
      }
    } else {
      // Mixing/Mastering - always available (async work)
      isAvailable = true;
      status = "available";
      message = "Votre demande de mixage/mastering peut être traitée.";
    }

    console.log(`Availability result: ${isAvailable} - ${status} - ${message}`);

    return new Response(
      JSON.stringify({ available: isAvailable, message, status }),
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
