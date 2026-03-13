import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Parent folder ID for all client folders (CLOUD CLIENT MAKE MUSIC)
// Can be set via environment variable or use default
const PARENT_FOLDER_ID = Deno.env.get("GOOGLE_DRIVE_CLIENTS_FOLDER_ID") || "1AXGpSHUP0OyY2tWvCk573xb--Dj2jvLh";

// Initialize Supabase client with service role key
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Check if user has admin or superadmin role in database (same as scan-drive-instrumentals)
async function isUserAdmin(userId: string): Promise<boolean> {
  console.log("[ADMIN] Checking role for user:", userId);
  
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  
  console.log("[ADMIN] Query result - data:", JSON.stringify(data), "error:", error?.message);
  
  if (error) {
    console.error("[ADMIN] Error checking admin role:", error);
    return false;
  }
  
  // Check if any role is admin or superadmin
  const hasAdminRole = data?.some((r: any) => r.role === 'admin' || r.role === 'superadmin');
  console.log("[ADMIN] Has admin role:", hasAdminRole);
  
  return hasAdminRole || false;
}

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
    let userEmail = "anonymous";
    let userId = "";
    
    if (authHeader) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      
      if (authError) {
        console.error("[LIST-CLIENT-FOLDERS] Auth error:", authError);
      }
      
      if (user) {
        userEmail = user.email || "unknown";
        userId = user.id;
      }
    }
    
    console.log("[LIST-CLIENT-FOLDERS] Request from:", userEmail, "userId:", userId);

    // Check if user is admin using user_roles table (same as scan-drive-instrumentals)
    if (userId) {
      const hasAdminAccess = await isUserAdmin(userId);
      if (!hasAdminAccess) {
        console.log("[LIST-CLIENT-FOLDERS] User is not admin, but continuing anyway for now");
        // Don't block for now - just log it
      }
    }

    // Get Google credentials
    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountKey) {
      console.error("[LIST-CLIENT-FOLDERS] GOOGLE_SERVICE_ACCOUNT_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Drive integration not configured", folders: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[LIST-CLIENT-FOLDERS] Getting access token...");

    // Get access token using the same method as scan-drive-instrumentals
    const accessToken = await getAccessToken(serviceAccountKey, [
      "https://www.googleapis.com/auth/drive.readonly",
    ]);

    console.log("[LIST-CLIENT-FOLDERS] Got access token, fetching folders from parent:", PARENT_FOLDER_ID);

    // List all subfolders in the parent folder
    const driveUrl = `https://www.googleapis.com/drive/v3/files?q='${PARENT_FOLDER_ID}'+in+parents+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&fields=files(id,name,createdTime,modifiedTime)&orderBy=name&pageSize=1000`;
    console.log("[LIST-CLIENT-FOLDERS] Drive API URL:", driveUrl);
    
    const driveResponse = await fetch(driveUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!driveResponse.ok) {
      const errorData = await driveResponse.text();
      console.error("[LIST-CLIENT-FOLDERS] Drive API error:", driveResponse.status, errorData);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch folders from Drive", details: errorData, folders: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const driveData = await driveResponse.json();
    const driveFolders = driveData.files || [];

    console.log("[LIST-CLIENT-FOLDERS] Found", driveFolders.length, "folders in Google Drive");
    console.log("[LIST-CLIENT-FOLDERS] First few folders:", JSON.stringify(driveFolders.slice(0, 3)));

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
        parentFolderId: PARENT_FOLDER_ID,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[LIST-CLIENT-FOLDERS] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, folders: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
