import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: { email: string }[];
  description?: string;
}

interface ClientStats {
  email: string;
  name: string | null;
  totalSessions: number;
  totalHours: number;
  firstSession: string | null;
  lastSession: string | null;
  sessions: {
    id: string;
    title: string;
    date: string;
    startHour: number;
    endHour: number;
    duration: number;
  }[];
}

async function getAccessToken(): Promise<string> {
  const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!serviceAccountJson) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
  }

  const serviceAccount = JSON.parse(serviceAccountJson);

  // Create JWT
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const claimB64 = btoa(JSON.stringify(claim)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const signatureInput = `${headerB64}.${claimB64}`;

  // Import private key
  const pemContents = serviceAccount.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, encoder.encode(signatureInput));

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signatureInput}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error("Failed to get access token");
  }

  return tokenData.access_token;
}

async function getAllCalendarEvents(accessToken: string, calendarId: string): Promise<CalendarEvent[]> {
  const allEvents: CalendarEvent[] = [];
  let pageToken: string | undefined;

  // Get events from the past 2 years
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const timeMin = twoYearsAgo.toISOString();

  do {
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set("maxResults", "2500");
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("timeMin", timeMin);
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Calendar API error:", error);
      throw new Error(`Calendar API error: ${response.status}`);
    }

    const data = await response.json();
    allEvents.push(...(data.items || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allEvents;
}

function extractClientEmailFromEvent(event: CalendarEvent): string | null {
  // 1. Check attendees
  if (event.attendees && event.attendees.length > 0) {
    // Find first attendee that's not the calendar owner
    const clientAttendee = event.attendees.find(a => 
      a.email && 
      !a.email.includes("calendar.google.com") &&
      !a.email.includes("makemusicstudio")
    );
    if (clientAttendee) {
      return clientAttendee.email.toLowerCase();
    }
  }

  // 2. Check description for email
  if (event.description) {
    const emailMatch = event.description.match(/[\w.-]+@[\w.-]+\.\w+/i);
    if (emailMatch) {
      return emailMatch[0].toLowerCase();
    }
  }

  // 3. Check event title for email
  if (event.summary) {
    const emailMatch = event.summary.match(/[\w.-]+@[\w.-]+\.\w+/i);
    if (emailMatch) {
      return emailMatch[0].toLowerCase();
    }
  }

  return null;
}

function extractClientNameFromEvent(event: CalendarEvent): string | null {
  if (!event.summary) return null;
  
  // Remove common prefixes and extract name
  const cleanTitle = event.summary
    .replace(/^(session|réservation|booking|rec|recording|enregistrement)\s*[-:]/i, "")
    .replace(/\s*[-:]\s*(avec ingénieur|sans ingénieur|location|mixage|mastering)/i, "")
    .trim();
  
  // If it looks like just an email, return null
  if (cleanTitle.includes("@")) {
    return null;
  }
  
  return cleanTitle || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID");
    if (!calendarId) {
      throw new Error("GOOGLE_CALENDAR_ID not configured");
    }

    const accessToken = await getAccessToken();
    const events = await getAllCalendarEvents(accessToken, calendarId);

    console.log(`[CLIENT-STATS] Found ${events.length} events in calendar`);

    // Group events by client email
    const clientsMap = new Map<string, ClientStats>();

    for (const event of events) {
      const email = extractClientEmailFromEvent(event);
      if (!email) continue;

      // Parse date and time
      const startDateTime = event.start.dateTime || event.start.date;
      const endDateTime = event.end.dateTime || event.end.date;
      if (!startDateTime || !endDateTime) continue;

      const startDate = new Date(startDateTime);
      const endDate = new Date(endDateTime);
      const dateStr = startDate.toISOString().split("T")[0];
      const startHour = startDate.getHours();
      const endHour = endDate.getHours() || 24;
      const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

      // Get or create client stats
      let client = clientsMap.get(email);
      if (!client) {
        client = {
          email,
          name: extractClientNameFromEvent(event),
          totalSessions: 0,
          totalHours: 0,
          firstSession: null,
          lastSession: null,
          sessions: [],
        };
        clientsMap.set(email, client);
      }

      // Update client stats
      client.totalSessions++;
      client.totalHours += duration;
      
      if (!client.firstSession || dateStr < client.firstSession) {
        client.firstSession = dateStr;
      }
      if (!client.lastSession || dateStr > client.lastSession) {
        client.lastSession = dateStr;
      }

      // Update name if not set
      if (!client.name) {
        client.name = extractClientNameFromEvent(event);
      }

      // Add session
      client.sessions.push({
        id: event.id,
        title: event.summary || "Session",
        date: dateStr,
        startHour,
        endHour,
        duration,
      });
    }

    // Convert to array and sort by last session
    const clients = Array.from(clientsMap.values())
      .sort((a, b) => (b.lastSession || "").localeCompare(a.lastSession || ""));

    // Sort sessions within each client
    clients.forEach(client => {
      client.sessions.sort((a, b) => b.date.localeCompare(a.date));
    });

    console.log(`[CLIENT-STATS] Found ${clients.length} unique clients`);

    return new Response(JSON.stringify({ clients }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[CLIENT-STATS] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});