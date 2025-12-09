import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const AvailabilityRequestSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD"),
  days: z.number().int().min(1).max(30).default(14),
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

interface TimeSlot {
  hour: number;
  available: boolean;
  status: "available" | "unavailable" | "on-request";
}

interface DayAvailability {
  date: string;
  slots: TimeSlot[];
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

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Calendar API error for ${calendarId}:`, errorText);
    throw new Error(`Failed to fetch calendar events: ${response.status}`);
  }

  const data: CalendarResponse = await response.json();
  return data.items || [];
}

// Parse iCal date format (YYYYMMDD or YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ)
function parseICalDate(dateStr: string): Date {
  // Remove any timezone suffix for simplicity
  const cleanStr = dateStr.replace(/Z$/, "");
  
  if (cleanStr.includes("T")) {
    // DateTime format: YYYYMMDDTHHMMSS
    const year = parseInt(cleanStr.substring(0, 4));
    const month = parseInt(cleanStr.substring(4, 6)) - 1;
    const day = parseInt(cleanStr.substring(6, 8));
    const hour = parseInt(cleanStr.substring(9, 11));
    const minute = parseInt(cleanStr.substring(11, 13));
    const second = parseInt(cleanStr.substring(13, 15)) || 0;
    return new Date(year, month, day, hour, minute, second);
  } else {
    // Date only format: YYYYMMDD
    const year = parseInt(cleanStr.substring(0, 4));
    const month = parseInt(cleanStr.substring(4, 6)) - 1;
    const day = parseInt(cleanStr.substring(6, 8));
    return new Date(year, month, day);
  }
}

// Fetch and parse iCal from webcal URL
async function fetchICalEvents(icalUrl: string, startDate: Date, endDate: Date): Promise<ICalEvent[]> {
  try {
    // Convert webcal:// to https://
    const httpsUrl = icalUrl.replace("webcal://", "https://");
    console.log(`Fetching iCal from: ${httpsUrl}`);
    
    const response = await fetch(httpsUrl);
    if (!response.ok) {
      console.error(`Failed to fetch iCal: ${response.status}`);
      return [];
    }
    
    const icalData = await response.text();
    const events: ICalEvent[] = [];
    
    // Simple iCal parser - extract VEVENT blocks
    const eventBlocks = icalData.split("BEGIN:VEVENT");
    
    for (let i = 1; i < eventBlocks.length; i++) {
      const block = eventBlocks[i].split("END:VEVENT")[0];
      
      let dtstart = "";
      let dtend = "";
      let isAllDay = false;
      
      const lines = block.split(/\r?\n/);
      for (const line of lines) {
        if (line.startsWith("DTSTART")) {
          // Check if it's a date-only (all-day) event
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
        const eventEnd = dtend ? parseICalDate(dtend) : new Date(eventStart.getTime() + 3600000); // Default 1 hour
        
        // Only include events that overlap with our date range
        if (eventEnd >= startDate && eventStart <= endDate) {
          events.push({ start: eventStart, end: eventEnd, isAllDay });
        }
      }
    }
    
    console.log(`Parsed ${events.length} iCal events from Claridge calendar`);
    return events;
  } catch (error) {
    console.error("Error fetching iCal:", error);
    return [];
  }
}

function isSlotAvailableInGoogle(
  events: CalendarEvent[],
  slotStart: Date,
  slotEnd: Date
): boolean {
  for (const event of events) {
    const eventStart = new Date(event.start.dateTime || event.start.date || "");
    const eventEnd = new Date(event.end.dateTime || event.end.date || "");
    
    // Check for all-day events
    if (event.start.date && !event.start.dateTime) {
      const eventDate = event.start.date;
      const slotDate = slotStart.toISOString().split("T")[0];
      if (eventDate === slotDate) {
        return false;
      }
    }
    
    // Check for overlap
    if (eventStart < slotEnd && eventEnd > slotStart) {
      return false;
    }
  }
  return true;
}

function isSlotBusyInICal(
  events: ICalEvent[],
  slotStart: Date,
  slotEnd: Date
): boolean {
  for (const event of events) {
    // Check for all-day events
    if (event.isAllDay) {
      const eventDate = event.start.toISOString().split("T")[0];
      const slotDate = slotStart.toISOString().split("T")[0];
      if (eventDate === slotDate) {
        return true;
      }
    }
    
    // Check for overlap
    if (event.start < slotEnd && event.end > slotStart) {
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
    // Parse and validate input
    const rawBody = await req.json();
    const validationResult = AvailabilityRequestSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error.errors);
      return new Response(
        JSON.stringify({ 
          error: "Invalid input", 
          details: validationResult.error.errors.map(e => e.message) 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const { startDate, days } = validationResult.data;
    
    console.log(`Fetching weekly availability starting from: ${startDate} for ${days} days`);

    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    const patronCalendarId = Deno.env.get("GOOGLE_PATRON_CALENDAR_ID");
    const studioCalendarId = Deno.env.get("GOOGLE_STUDIO_CALENDAR_ID");
    const claridgeIcalUrl = Deno.env.get("CLARIDGE_ICAL_URL");

    if (!serviceAccountKey || !patronCalendarId || !studioCalendarId) {
      throw new Error("Missing calendar configuration");
    }

    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + days);

    const accessToken = await getAccessToken(serviceAccountKey);

    // Fetch events from all calendars
    const [patronEvents, studioEvents, claridgeEvents] = await Promise.all([
      getCalendarEvents(accessToken, patronCalendarId, start.toISOString(), end.toISOString()),
      getCalendarEvents(accessToken, studioCalendarId, start.toISOString(), end.toISOString()),
      claridgeIcalUrl ? fetchICalEvents(claridgeIcalUrl, start, end) : Promise.resolve([]),
    ]);

    // Studio events = patron + studio calendar (main availability)
    const studioMainEvents = [...patronEvents, ...studioEvents];
    console.log(`Total main events found: ${studioMainEvents.length}`);
    console.log(`Claridge events found: ${claridgeEvents.length}`);

    // Generate availability for each day
    const availability: DayAvailability[] = [];
    const workingHours = { start: 10, end: 23 }; // 10:00 - 23:00

    for (let d = 0; d < days; d++) {
      const currentDate = new Date(start);
      currentDate.setDate(currentDate.getDate() + d);
      
      const dateStr = currentDate.toISOString().split("T")[0];
      const slots: TimeSlot[] = [];

      for (let hour = workingHours.start; hour < workingHours.end; hour++) {
        const slotStart = new Date(currentDate);
        slotStart.setHours(hour, 0, 0, 0);
        
        const slotEnd = new Date(slotStart);
        slotEnd.setHours(hour + 1, 0, 0, 0);

        // Check if slot is in the past
        const now = new Date();
        if (slotStart < now) {
          slots.push({ hour, available: false, status: "unavailable" });
          continue;
        }

        // Check main studio availability (patron + studio calendars)
        const isMainAvailable = isSlotAvailableInGoogle(studioMainEvents, slotStart, slotEnd);
        
        if (!isMainAvailable) {
          // Studio is booked - unavailable
          slots.push({ hour, available: false, status: "unavailable" });
        } else {
          // Studio is free, check if patron is busy in personal/Claridge calendars
          const isPatronBusyInClaridge = isSlotBusyInICal(claridgeEvents, slotStart, slotEnd);
          
          if (isPatronBusyInClaridge) {
            // Patron busy in Claridge but studio is free - show "on request"
            slots.push({ hour, available: true, status: "on-request" });
          } else {
            // Fully available
            slots.push({ hour, available: true, status: "available" });
          }
        }
      }

      availability.push({ date: dateStr, slots });
    }

    return new Response(
      JSON.stringify({ availability }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching weekly availability:", errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
