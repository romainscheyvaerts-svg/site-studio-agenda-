import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Escape single quotes in Drive API query values to prevent injection
function escapeDriveQueryValue(value: string): string {
  return value.replace(/'/g, "\\'");
}

// Validate folder name matches expected safe pattern
function isValidFolderName(name: string): boolean {
  const SAFE_FOLDER_NAME = /^[a-zA-Z0-9\s\-_@.àâäéèêëïîôùûüç]+$/i;
  return SAFE_FOLDER_NAME.test(name) && name.length <= 200;
}

// Input validation schema
const AvailabilityRequestSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD"),
  days: z.number().int().min(1).max(90).default(14), // Increased to 90 for monthly view
});

interface CalendarEvent {
  id?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  summary?: string;
  description?: string;
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
  eventName?: string;
  eventId?: string;
  clientEmail?: string;
  driveFolderLink?: string;
  driveSessionFolderLink?: string;
  secondaryCalendarEventName?: string; // For secondary calendar events (visible to admin only)
  hasSecondaryCalendarConflict?: boolean;
  tertiaryCalendarEventName?: string; // For tertiary calendar events (visible to admin only)
  hasTertiaryCalendarConflict?: boolean;
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
  // Request full event details including description
  url.searchParams.set("fields", "items(id,summary,description,start,end)");

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
): { available: boolean; eventName?: string; eventId?: string; clientEmail?: string } {
  for (const event of events) {
    const eventStart = new Date(event.start.dateTime || event.start.date || "");
    const eventEnd = new Date(event.end.dateTime || event.end.date || "");
    
    // Extract client email from event details if present
    let clientEmail: string | undefined;
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;

    const descriptionText = event.description || "";
    const summaryText = event.summary || "";

    // Prefer explicit "Email:" label if present, fallback to any email in description/summary
    const labeledMatch = descriptionText.match(/Email:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    const anyDescMatch = descriptionText.match(emailRegex);
    const anySummaryMatch = summaryText.match(emailRegex);

    clientEmail = (labeledMatch?.[1] || anyDescMatch?.[1] || anySummaryMatch?.[1])?.toLowerCase();
    // Check for all-day events
    if (event.start.date && !event.start.dateTime) {
      const eventDate = event.start.date;
      const slotDate = slotStart.toISOString().split("T")[0];
      if (eventDate === slotDate) {
        return { available: false, eventName: event.summary, eventId: event.id, clientEmail };
      }
    }
    
    // Check for overlap
    if (eventStart < slotEnd && eventEnd > slotStart) {
      return { available: false, eventName: event.summary, eventId: event.id, clientEmail };
    }
  }
  return { available: true };
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
    const secondaryCalendarId = Deno.env.get("GOOGLE_SECONDARY_CALENDAR_ID");
    const tertiaryCalendarId = Deno.env.get("GOOGLE_TERTIARY_CALENDAR_ID");

    if (!serviceAccountKey || !patronCalendarId || !studioCalendarId) {
      throw new Error("Missing calendar configuration");
    }

    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + days);

    const accessToken = await getAccessToken(serviceAccountKey);

    // Fetch events from all calendars (including secondary and tertiary if configured)
    const [patronEvents, studioEvents, claridgeEvents, secondaryEvents, tertiaryEvents] = await Promise.all([
      getCalendarEvents(accessToken, patronCalendarId, start.toISOString(), end.toISOString()),
      getCalendarEvents(accessToken, studioCalendarId, start.toISOString(), end.toISOString()),
      claridgeIcalUrl ? fetchICalEvents(claridgeIcalUrl, start, end) : Promise.resolve([]),
      secondaryCalendarId ? getCalendarEvents(accessToken, secondaryCalendarId, start.toISOString(), end.toISOString()) : Promise.resolve([]),
      tertiaryCalendarId ? getCalendarEvents(accessToken, tertiaryCalendarId, start.toISOString(), end.toISOString()) : Promise.resolve([]),
    ]);

    // Only studio calendar determines main availability (unavailable)
    // Patron calendar + Claridge calendar trigger "on-request"
    // Secondary and tertiary calendar events are marked for admin visibility
    console.log(`Studio events found: ${studioEvents.length}`);
    console.log(`Patron (personal) events found: ${patronEvents.length}`);
    console.log(`Claridge events found: ${claridgeEvents.length}`);
    console.log(`Secondary calendar events found: ${secondaryEvents.length}`);
    console.log(`Tertiary calendar events found: ${tertiaryEvents.length}`);

    // Generate availability for each day
    const availability: DayAvailability[] = [];
    const workingHours = { start: 0, end: 24 }; // 24h/24

    // Build a map of client email -> Drive folder info (from database)
    const driveLinkMap = new Map<string, { link: string; folderId: string }>();
    try {
      const { data: folders } = await supabase
        .from("client_drive_folders")
        .select("client_email, drive_folder_link, drive_folder_id");

      (folders || []).forEach((f: any) => {
        if (f?.client_email && f?.drive_folder_link && f?.drive_folder_id) {
          driveLinkMap.set(String(f.client_email).toLowerCase(), {
            link: String(f.drive_folder_link),
            folderId: String(f.drive_folder_id),
          });
        }
      });
    } catch (e) {
      console.error("Failed to load drive folders map", e);
    }

    // Helper function to find session subfolder by date
    async function findSessionSubfolder(
      parentFolderId: string,
      sessionDate: string,
      accessToken: string
    ): Promise<string | undefined> {
      try {
        // Validate sessionDate format (YYYY-MM-DD) to prevent injection
        if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) {
          console.error(`[SECURITY] Invalid session date format rejected: ${sessionDate}`);
          return undefined;
        }
        
        // Escape the session date value for safety
        const escapedDate = escapeDriveQueryValue(sessionDate);
        const query = `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${escapedDate}' and trashed = false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
        
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        
        if (!response.ok) {
          console.log("Failed to search for session subfolder:", await response.text());
          return undefined;
        }
        
        const data = await response.json();
        if (data.files && data.files.length > 0) {
          return `https://drive.google.com/drive/folders/${data.files[0].id}`;
        }
        return undefined;
      } catch (e) {
        console.error("Error finding session subfolder:", e);
        return undefined;
      }
    }

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

        // Check ONLY studio calendar for main availability
        const studioResult = isSlotAvailableInGoogle(studioEvents, slotStart, slotEnd);
        
        if (!studioResult.available) {
          const clientEmail = studioResult.clientEmail;
          const driveInfo = clientEmail ? driveLinkMap.get(clientEmail.toLowerCase()) : undefined;
          
          // Try to find session subfolder by date
          let driveSessionFolderLink: string | undefined;
          if (driveInfo?.folderId) {
            driveSessionFolderLink = await findSessionSubfolder(driveInfo.folderId, dateStr, accessToken);
          }

          // Studio is booked - unavailable
          slots.push({
            hour,
            available: false,
            status: "unavailable",
            eventName: studioResult.eventName,
            eventId: studioResult.eventId,
            clientEmail,
            driveFolderLink: driveInfo?.link,
            driveSessionFolderLink,
          });
        } else {
          // Studio is free, check if patron is busy in personal Google calendar OR Claridge
          const patronResult = isSlotAvailableInGoogle(patronEvents, slotStart, slotEnd);
          const isPatronBusyInClaridge = isSlotBusyInICal(claridgeEvents, slotStart, slotEnd);
          
        // For available or on-request slots, check if there's a secondary or tertiary calendar event
        const secondaryResult = isSlotAvailableInGoogle(secondaryEvents, slotStart, slotEnd);
        const hasSecondaryConflict = !secondaryResult.available;
        
        const tertiaryResult = isSlotAvailableInGoogle(tertiaryEvents, slotStart, slotEnd);
        const hasTertiaryConflict = !tertiaryResult.available;

        if (!patronResult.available || isPatronBusyInClaridge) {
            // Patron busy (personal or Claridge) but studio is free - show "on request"
            slots.push({ 
              hour, 
              available: true, 
              status: "on-request",
              hasSecondaryCalendarConflict: hasSecondaryConflict,
              secondaryCalendarEventName: hasSecondaryConflict ? secondaryResult.eventName : undefined,
              hasTertiaryCalendarConflict: hasTertiaryConflict,
              tertiaryCalendarEventName: hasTertiaryConflict ? tertiaryResult.eventName : undefined
            });
          } else {
            // Fully available
            slots.push({ 
              hour, 
              available: true, 
              status: "available",
              hasSecondaryCalendarConflict: hasSecondaryConflict,
              secondaryCalendarEventName: hasSecondaryConflict ? secondaryResult.eventName : undefined,
              hasTertiaryCalendarConflict: hasTertiaryConflict,
              tertiaryCalendarEventName: hasTertiaryConflict ? tertiaryResult.eventName : undefined
            });
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
