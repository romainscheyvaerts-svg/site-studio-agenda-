import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Parent folder ID for all client folders (CLOUD CLIENT MAKE MUSIC)
const PARENT_FOLDER_ID = "1AXGpSHUP0OyY2tWvCk573xb--Dj2jvLh";

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

async function getAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: exp,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const privateKeyPem = credentials.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\n/g, "");
  const privateKeyDer = Uint8Array.from(atob(privateKeyPem), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, encoder.encode(unsignedToken));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsignedToken}.${signatureB64}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) {
    throw new Error(`Token error: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Create client with user token to verify admin status
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user from token
    const { data: userData, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userEmail = userData.user.email?.toLowerCase().trim();

    // Check if user is admin
    const { data: adminData } = await supabaseAdmin
      .from("admin_users")
      .select("id")
      .eq("email", userEmail)
      .maybeSingle();

    if (!adminData) {
      return new Response(
        JSON.stringify({ error: "Not authorized - admin only" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[LIST-CLIENT-FOLDERS] Admin verified:", userEmail);

    // Get Google credentials
    const serviceAccountKeyStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountKeyStr) {
      console.error("[LIST-CLIENT-FOLDERS] GOOGLE_SERVICE_ACCOUNT_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Drive integration not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credentials = JSON.parse(serviceAccountKeyStr);
    const accessToken = await getAccessToken(credentials);

    console.log("[LIST-CLIENT-FOLDERS] Fetching folders from Google Drive...");

    // List all subfolders in the parent folder
    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${PARENT_FOLDER_ID}'+in+parents+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&fields=files(id,name,createdTime,modifiedTime)&orderBy=name&pageSize=1000`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!driveResponse.ok) {
      const errorData = await driveResponse.json();
      console.error("[LIST-CLIENT-FOLDERS] Drive API error:", errorData);
      return new Response(
        JSON.stringify({ error: "Failed to fetch folders from Drive" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const driveData = await driveResponse.json();
    const driveFolders = driveData.files || [];

    console.log("[LIST-CLIENT-FOLDERS] Found", driveFolders.length, "folders in Google Drive");

    // Transform to the expected format
    const folders = driveFolders.map((folder: { id: string; name: string; createdTime?: string; modifiedTime?: string }) => ({
      id: folder.id,
      client_email: folder.name,
      client_name: folder.name,
      drive_folder_id: folder.id,
      drive_folder_link: `https://drive.google.com/drive/folders/${folder.id}`,
      created_at: folder.createdTime || new Date().toISOString(),
      modified_at: folder.modifiedTime || new Date().toISOString(),
    }));

    return new Response(
      JSON.stringify({ 
        success: true,
        folders: folders,
        count: folders.length,
        source: "google_drive",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[LIST-CLIENT-FOLDERS] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
