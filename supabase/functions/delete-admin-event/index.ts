import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize Supabase client with service role key
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
  
  if (error) {
    console.error("[ADMIN] Error checking admin role:", error);
    return false;
  }
  
  return data && data.length > 0;
}

// Get Google OAuth2 access token using service account
async function getAccessToken(serviceAccountKey: string, scopes: string[]): Promise<string> {
  const key = JSON.parse(serviceAccountKey);
  
  // Create JWT header and claim set
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: key.client_email,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  // Base64url encode
  const encoder = new TextEncoder();
  const base64url = (data: Uint8Array) => btoa(String.fromCharCode(...data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  
  const headerB64 = base64url(encoder.encode(JSON.stringify(header)));
  const claimSetB64 = base64url(encoder.encode(JSON.stringify(claimSet)));
  const signatureInput = `${headerB64}.${claimSetB64}`;

  // Import private key and sign
  const pemContent = key.private_key.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));
  
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

  const jwt = `${signatureInput}.${base64url(new Uint8Array(signature))}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("Token exchange failed:", errorText);
    throw new Error("Failed to get access token");
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// Delete a Google Calendar event
async function deleteCalendarEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok && response.status !== 410) { // 410 means already deleted
    const errorText = await response.text();
    console.error("Failed to delete calendar event:", errorText);
    throw new Error(`Failed to delete calendar event: ${response.status}`);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated and is admin
    // Try both lowercase and uppercase Authorization header
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    console.log("[DELETE-ADMIN-EVENT] Auth header present:", !!authHeader);

    if (!authHeader) {
      console.log("[DELETE-ADMIN-EVENT] No auth header found");
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("[DELETE-ADMIN-EVENT] Token length:", token.length);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    console.log("[DELETE-ADMIN-EVENT] Auth result - user:", user?.email, "error:", authError?.message);

    if (authError || !user) {
      console.log("[DELETE-ADMIN-EVENT] Auth failed:", authError?.message || "No user");
      return new Response(JSON.stringify({
        error: "Unauthorized",
        details: authError?.message || "User not found",
        hint: "Make sure you are logged in with a valid session"
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[DELETE-ADMIN-EVENT] User authenticated:", user.email, user.id);

    // Check if user is admin via database role check
    const hasAdminRole = await isUserAdmin(user.id);
    if (!hasAdminRole) {
      console.log("[ADMIN-EVENT] User lacks admin role:", user.email);
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { eventId } = await req.json();

    if (!eventId) {
      return new Response(JSON.stringify({ error: "Event ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Google Calendar credentials
    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    const calendarId = Deno.env.get("GOOGLE_STUDIO_CALENDAR_ID");

    if (!serviceAccountKey || !calendarId) {
      console.error("Missing Google Calendar configuration");
      return new Response(JSON.stringify({ error: "Calendar configuration missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get access token
    const accessToken = await getAccessToken(serviceAccountKey, [
      "https://www.googleapis.com/auth/calendar.events",
    ]);

    // Delete the event
    await deleteCalendarEvent(accessToken, calendarId, eventId);

    console.log(`Admin ${user.email} deleted calendar event ${eventId}`);

    return new Response(
      JSON.stringify({ success: true, message: "Event deleted successfully" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error deleting event:", errorMessage, error);
    return new Response(
      JSON.stringify({ error: errorMessage, details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
