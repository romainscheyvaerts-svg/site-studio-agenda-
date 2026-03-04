import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Parent folder ID for all client folders (CLOUD CLIENT MAKE MUSIC)
const PARENT_FOLDER_ID = "1AXGpSHUP0OyY2tWvCk573xb--Dj2jvLh";

// Initialize Supabase client with service role key
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get Google OAuth2 access token using service account (same as scan-drive-instrumentals)
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

    // Verify user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      console.error("[LIST-CLIENT-FOLDERS] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userEmail = user.email?.toLowerCase().trim();
    console.log("[LIST-CLIENT-FOLDERS] Request from:", userEmail);

    // Check if user is admin
    const { data: adminData } = await supabase
      .from("admin_users")
      .select("id")
      .eq("email", userEmail)
      .maybeSingle();

    if (!adminData) {
      console.error("[LIST-CLIENT-FOLDERS] User is not admin:", userEmail);
      return new Response(
        JSON.stringify({ error: "Not authorized - admin only" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[LIST-CLIENT-FOLDERS] Admin verified:", userEmail);

    // Get Google credentials
    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountKey) {
      console.error("[LIST-CLIENT-FOLDERS] GOOGLE_SERVICE_ACCOUNT_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Drive integration not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get access token using the same method as scan-drive-instrumentals
    const accessToken = await getAccessToken(serviceAccountKey, [
      "https://www.googleapis.com/auth/drive.readonly",
    ]);

    console.log("[LIST-CLIENT-FOLDERS] Got access token, fetching folders...");

    // List all subfolders in the parent folder
    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${PARENT_FOLDER_ID}'+in+parents+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&fields=files(id,name,createdTime,modifiedTime)&orderBy=name&pageSize=1000`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!driveResponse.ok) {
      const errorData = await driveResponse.text();
      console.error("[LIST-CLIENT-FOLDERS] Drive API error:", errorData);
      return new Response(
        JSON.stringify({ error: "Failed to fetch folders from Drive", details: errorData }),
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
