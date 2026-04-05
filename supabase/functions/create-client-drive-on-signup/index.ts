import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Parent folder ID will be fetched from studio config in database

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
    scope: "https://www.googleapis.com/auth/drive",
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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userEmail = userData.user.email?.toLowerCase().trim();
    const userName = userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || userEmail;

    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: "No email found for user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[CREATE-DRIVE-ON-SIGNUP] Creating Drive folder for new user:", userEmail);

    // Check if client already has a folder
    const { data: existingFolder } = await supabase
      .from("client_drive_folders")
      .select("*")
      .eq("client_email", userEmail)
      .maybeSingle();

    if (existingFolder) {
      console.log("[CREATE-DRIVE-ON-SIGNUP] Folder already exists for:", userEmail);
      return new Response(
        JSON.stringify({ 
          success: true,
          alreadyExists: true,
          folderLink: existingFolder.drive_folder_link,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Google credentials from studio config in database
    // Find the studio this user belongs to (check user_roles or use first studio)
    let serviceAccountKeyStr: string | null = null;
    let PARENT_FOLDER_ID: string | null = null;

    // Try to find studio via user_roles
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("studio_id")
      .eq("user_id", userData.user.id)
      .limit(1)
      .maybeSingle();

    if (roleData?.studio_id) {
      const { data: studioData } = await supabase
        .from("studios")
        .select("google_drive_parent_folder_id, google_service_account_key")
        .eq("id", roleData.studio_id)
        .single();

      if (studioData) {
        PARENT_FOLDER_ID = studioData.google_drive_parent_folder_id;
        serviceAccountKeyStr = studioData.google_service_account_key;
      }
    }

    // Fallback to env vars
    if (!serviceAccountKeyStr) {
      serviceAccountKeyStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY") || null;
    }
    if (!PARENT_FOLDER_ID) {
      PARENT_FOLDER_ID = Deno.env.get("GOOGLE_DRIVE_CLIENTS_FOLDER_ID") || null;
    }

    if (!serviceAccountKeyStr || !PARENT_FOLDER_ID) {
      console.error("[CREATE-DRIVE-ON-SIGNUP] Drive not configured (no studio config, no env vars)");
      return new Response(
        JSON.stringify({ error: "Drive integration not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credentials = JSON.parse(serviceAccountKeyStr);
    const accessToken = await getAccessToken(credentials);

    // Create new client folder with email as name
    console.log("[CREATE-DRIVE-ON-SIGNUP] Creating new Drive folder for:", userEmail, "in parent:", PARENT_FOLDER_ID);
    
    const createFolderResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: userEmail,
        mimeType: "application/vnd.google-apps.folder",
        parents: [PARENT_FOLDER_ID],
      }),
    });

    const newFolder = await createFolderResponse.json();
    if (!createFolderResponse.ok) {
      console.error("[CREATE-DRIVE-ON-SIGNUP] Failed to create folder:", newFolder);
      throw new Error(`Failed to create client folder: ${JSON.stringify(newFolder)}`);
    }

    const clientFolderId = newFolder.id;
    const clientFolderLink = `https://drive.google.com/drive/folders/${newFolder.id}`;

    // Set folder permissions (anyone with link can write)
    await fetch(`https://www.googleapis.com/drive/v3/files/${newFolder.id}/permissions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "writer",
        type: "anyone",
      }),
    });

    // Save to database
    const { error: insertError } = await supabase.from("client_drive_folders").insert({
      client_email: userEmail,
      client_name: userName,
      drive_folder_id: clientFolderId,
      drive_folder_link: clientFolderLink,
    });

    if (insertError) {
      console.error("[CREATE-DRIVE-ON-SIGNUP] Failed to save folder to DB:", insertError);
      // Don't fail the request - folder was created successfully
    }

    console.log("[CREATE-DRIVE-ON-SIGNUP] Successfully created folder for:", userEmail, "->", clientFolderLink);

    return new Response(
      JSON.stringify({ 
        success: true,
        alreadyExists: false,
        folderLink: clientFolderLink,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[CREATE-DRIVE-ON-SIGNUP] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
