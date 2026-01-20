import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Check if user has admin or superadmin role in database
async function isUserAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "superadmin"]);

  if (error) return false;
  return data && data.length > 0;
}

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
    throw new Error("Failed to get access token");
  }

  return tokenData.access_token;
}

// Update calendar event
async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  updates: {
    summary?: string;
    start?: string;
    end?: string;
    colorId?: string;
  }
): Promise<{ id: string; htmlLink: string }> {
  // First, get the existing event
  const getUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

  const getResponse = await fetch(getUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!getResponse.ok) {
    throw new Error(`Failed to get calendar event: ${getResponse.status}`);
  }

  const existingEvent = await getResponse.json();

  // Prepare updated event
  const updatedEvent: Record<string, unknown> = {
    ...existingEvent,
  };

  if (updates.summary) {
    updatedEvent.summary = updates.summary;
  }

  if (updates.start) {
    updatedEvent.start = {
      dateTime: updates.start,
      timeZone: "Europe/Brussels",
    };
  }

  if (updates.end) {
    updatedEvent.end = {
      dateTime: updates.end,
      timeZone: "Europe/Brussels",
    };
  }

  if (updates.colorId) {
    updatedEvent.colorId = updates.colorId;
  }

  const updateUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

  const response = await fetch(updateUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatedEvent),
  });

  if (!response.ok) {
    throw new Error(`Failed to update calendar event: ${response.status}`);
  }

  const result = await response.json();

  return {
    id: result.id,
    htmlLink: result.htmlLink,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // SÉCURITÉ: Vérifier le token avec supabase.auth.getUser() au lieu de décodage manuel
    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;

    // Check if user is admin via database role check
    const hasAdminRole = await isUserAdmin(userId);
    if (!hasAdminRole) {
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { eventId, title, date, startTime, endTime, colorId } = body;

    // Validate required fields
    if (!eventId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: eventId" }),
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

    // Build update object
    const updates: {
      summary?: string;
      start?: string;
      end?: string;
      colorId?: string;
    } = {};

    if (title) {
      updates.summary = title;
    }

    if (date && startTime) {
      const [year, month, day] = date.split("-").map(Number);
      const [startHour, startMinute] = startTime.split(":").map(Number);

      const startDate = new Date(year, month - 1, day, startHour, startMinute || 0);
      updates.start = startDate.toISOString().replace('Z', '+01:00');
    }

    if (date && endTime) {
      const [year, month, day] = date.split("-").map(Number);
      const [endHour, endMinute] = endTime.split(":").map(Number);

      const endDate = new Date(year, month - 1, day, endHour, endMinute || 0);
      updates.end = endDate.toISOString().replace('Z', '+01:00');
    }

    if (colorId) {
      updates.colorId = colorId;
    }

    // Update the event
    const updatedEvent = await updateCalendarEvent(accessToken, studioCalendarId, eventId, updates);

    return new Response(
      JSON.stringify({
        success: true,
        eventId: updatedEvent.id,
        eventLink: updatedEvent.htmlLink,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
