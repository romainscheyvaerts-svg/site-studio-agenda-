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

// Get Google OAuth2 access token using service account
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

// Folder ID for instrumentals - Updated folder
const INSTRUMENTALS_FOLDER_ID = "1fo_SnmEfdSM2PDv90ujDUzkDhR3KRUVu";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ADMIN_EMAILS = ["prod.makemusic@gmail.com", "kazamzamka@gmail.com"];
    if (!user.email || !ADMIN_EMAILS.includes(user.email)) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Google credentials
    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountKey) {
      console.error("Missing Google service account key");
      return new Response(JSON.stringify({ error: "Configuration missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get access token
    const accessToken = await getAccessToken(serviceAccountKey, [
      "https://www.googleapis.com/auth/drive.readonly",
    ]);

    // List audio files in the folder
    const listResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${INSTRUMENTALS_FOLDER_ID}'+in+parents+and+(mimeType+contains+'audio'+or+name+contains+'.mp3'+or+name+contains+'.wav'+or+name+contains+'.flac')&fields=files(id,name,mimeType,createdTime,size)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error("Failed to list drive files:", errorText);
      throw new Error("Failed to list drive files");
    }

    const listData = await listResponse.json();
    const driveFiles = listData.files || [];

    console.log(`Found ${driveFiles.length} audio files in Drive folder`);

    // Get existing instrumentals from database
    const { data: existingInstrumentals, error: dbError } = await supabase
      .from("instrumentals")
      .select("drive_file_id, title");

    if (dbError) {
      console.error("DB error:", dbError);
      throw new Error("Database error");
    }

    const existingDriveIds = new Set(existingInstrumentals?.map(i => i.drive_file_id) || []);

    // Separate into new and existing files
    const driveFilesWithStatus = driveFiles.map((file: any) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      createdTime: file.createdTime,
      size: file.size,
      isInDatabase: existingDriveIds.has(file.id),
    }));

    return new Response(
      JSON.stringify({ 
        files: driveFilesWithStatus,
        totalInDrive: driveFiles.length,
        totalInDatabase: existingInstrumentals?.length || 0,
        newFiles: driveFilesWithStatus.filter((f: any) => !f.isInDatabase).length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error scanning drive:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});