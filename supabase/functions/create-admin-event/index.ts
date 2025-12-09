import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get OAuth2 access token for Google APIs
async function getAccessToken(serviceAccountKey: string, scopes: string[]): Promise<string> {
  const key = JSON.parse(serviceAccountKey);
  
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: key.client_email,
    scope: scopes.join(" "),
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

// Create calendar event with color
async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: {
    summary: string;
    description: string;
    start: string;
    end: string;
    colorId?: string;
  }
): Promise<{ id: string; htmlLink: string }> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

  const eventBody: Record<string, unknown> = {
    summary: event.summary,
    description: event.description,
    start: {
      dateTime: event.start,
      timeZone: "Europe/Brussels",
    },
    end: {
      dateTime: event.end,
      timeZone: "Europe/Brussels",
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 30 },
      ],
    },
  };

  // Add color if specified
  if (event.colorId) {
    eventBody.colorId = event.colorId;
  }

  console.log(`[ADMIN-EVENT] Creating event: ${event.summary}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[ADMIN-EVENT] Error creating event:`, errorText);
    throw new Error(`Failed to create calendar event: ${response.status}`);
  }

  const createdEvent = await response.json();
  console.log(`[ADMIN-EVENT] Event created successfully: ${createdEvent.id}`);
  
  return {
    id: createdEvent.id,
    htmlLink: createdEvent.htmlLink,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    if (user.email !== "prod.makemusic@gmail.com") {
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { title, clientName, description, date, time, hours, colorId } = body;

    console.log("[ADMIN-EVENT] Creating event:", { title, clientName, date, time, hours, colorId });

    // Validate required fields
    if (!title || !date || !time) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: title, date, time" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Google Calendar credentials
    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    const studioCalendarId = Deno.env.get("GOOGLE_STUDIO_CALENDAR_ID");

    if (!serviceAccountKey || !studioCalendarId) {
      return new Response(
        JSON.stringify({ error: "Calendar configuration missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get access token
    const accessToken = await getAccessToken(serviceAccountKey, ["https://www.googleapis.com/auth/calendar"]);

    // Parse date and time
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    
    const startDate = new Date(year, month - 1, day, hour, minute);
    const endDate = new Date(startDate.getTime() + (hours || 2) * 60 * 60 * 1000);
    
    const formatForCalendar = (d: Date): string => {
      return d.toISOString().replace('Z', '+01:00');
    };

    // Build event summary with client name if provided
    let eventSummary = title;
    if (clientName) {
      eventSummary = `${title} - ${clientName}`;
    }

    // Build description
    const eventDescription = [
      clientName ? `Client: ${clientName}` : null,
      `Durée: ${hours || 2}h`,
      `Créé par: Admin`,
      description ? `\nNotes: ${description}` : null,
    ].filter(Boolean).join('\n');

    // Create the event
    const createdEvent = await createCalendarEvent(accessToken, studioCalendarId, {
      summary: eventSummary,
      description: eventDescription,
      start: formatForCalendar(startDate),
      end: formatForCalendar(endDate),
      colorId: colorId || undefined,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        eventId: createdEvent.id,
        eventLink: createdEvent.htmlLink,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[ADMIN-EVENT] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
