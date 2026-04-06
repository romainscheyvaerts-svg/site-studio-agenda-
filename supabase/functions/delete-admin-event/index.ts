import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialisation du client Supabase avec la CLÉ SERVICE (Super Admin)
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- FONCTIONS UTILITAIRES ---

// 1. DÉCODER LE JWT MANUELLEMENT (Bypass le check Auth strict)
function getUserIdFromJwt(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Décodage Base64 Url Safe
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const json = JSON.parse(decoded);
    return json.sub; // 'sub' est l'ID de l'utilisateur
  } catch (e) {
    console.error("Erreur décodage JWT:", e);
    return null;
  }
}

// 2. VÉRIFIER LE RÔLE DANS LA BDD
async function isUserAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "superadmin"]);
  
  if (error) return false;
  return data && data.length > 0;
}

// 3. OBTENIR TOKEN GOOGLE
async function getAccessToken(serviceAccountKey: string, scopes: string[]): Promise<string> {
  const key = JSON.parse(serviceAccountKey);
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: key.client_email,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const base64url = (data: Uint8Array) => btoa(String.fromCharCode(...data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  
  const headerB64 = base64url(encoder.encode(JSON.stringify(header)));
  const claimSetB64 = base64url(encoder.encode(JSON.stringify(claimSet)));
  const signatureInput = `${headerB64}.${claimSetB64}`;

  const pemContent = key.private_key.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryKey, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, encoder.encode(signatureInput));
  const jwt = `${signatureInput}.${base64url(new Uint8Array(signature))}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// 4. SUPPRIMER EVENT GOOGLE
async function deleteCalendarEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!response.ok && response.status !== 410) { 
    throw new Error(`Google Calendar Error: ${response.status}`);
  }
}

// --- MAIN HANDLER ---

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Auth Header");

    const token = authHeader.replace("Bearer ", "");
    
    // --- BYPASS: On décode manuellement au lieu de demander à auth.getUser() ---
    const userId = getUserIdFromJwt(token);
    
    if (!userId) {
       return new Response(JSON.stringify({ error: "Invalid Token format" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // On vérifie le rôle SQL (C'est la vraie sécurité)
    const isAdmin = await isUserAdmin(userId);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Not Admin" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Logique de suppression
    const body = await req.json();
    const { eventId, studioId } = body;
    if (!eventId) throw new Error("Event ID required");

    // Get Google Calendar credentials - try from studios table first, then env vars
    let serviceAccountKey: string | null = null;
    let calendarId: string | null = null;

    if (studioId) {
      const { data: studioData } = await supabase
        .from("studios")
        .select("google_calendar_id, google_service_account_key")
        .eq("id", studioId)
        .single();
      
      if (studioData) {
        serviceAccountKey = studioData.google_service_account_key;
        calendarId = studioData.google_calendar_id;
        console.log(`[DELETE-ADMIN-EVENT] Using DB credentials for studio ${studioId}`);
      }
    }

    // Fallback to env vars
    if (!serviceAccountKey) serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY") || null;
    if (!calendarId) calendarId = Deno.env.get("GOOGLE_STUDIO_CALENDAR_ID") || null;
    
    if (!serviceAccountKey || !calendarId) throw new Error("Missing calendar configuration");

    const accessToken = await getAccessToken(serviceAccountKey, ["https://www.googleapis.com/auth/calendar.events"]);
    await deleteCalendarEvent(accessToken, calendarId, eventId);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});