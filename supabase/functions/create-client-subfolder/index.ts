import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PARENT_FOLDER_ID = "1hmo7HY7xX_mvXXm6vUCRuR2HB6C49Y-r";

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
    const { clientEmail, clientName, sessionDate } = await req.json();
    
    console.log("[CREATE-SUBFOLDER] Creating subfolder for:", clientEmail, "date:", sessionDate);

    const serviceAccountKeyStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountKeyStr) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not configured");
    }

    const credentials = JSON.parse(serviceAccountKeyStr);
    const accessToken = await getAccessToken(credentials);

    // Initialize Supabase to check for existing client folder
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if client already has a folder
    const { data: existingFolder } = await supabase
      .from("client_drive_folders")
      .select("*")
      .eq("client_email", clientEmail)
      .maybeSingle();

    let clientFolderId: string;
    let clientFolderLink: string;

    if (existingFolder) {
      console.log("[CREATE-SUBFOLDER] Using existing client folder:", existingFolder.drive_folder_id);
      clientFolderId = existingFolder.drive_folder_id;
      clientFolderLink = existingFolder.drive_folder_link;
    } else {
      // Create new client folder
      console.log("[CREATE-SUBFOLDER] Creating new client folder");
      
      const createFolderResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: clientEmail, // Use email as folder name to avoid duplicates (case sensitivity)
          mimeType: "application/vnd.google-apps.folder",
          parents: [PARENT_FOLDER_ID],
        }),
      });

      const newFolder = await createFolderResponse.json();
      if (!createFolderResponse.ok) {
        throw new Error(`Failed to create client folder: ${JSON.stringify(newFolder)}`);
      }

      clientFolderId = newFolder.id;
      clientFolderLink = `https://drive.google.com/drive/folders/${newFolder.id}`;

      // Set folder permissions
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
      await supabase.from("client_drive_folders").insert({
        client_email: clientEmail,
        client_name: clientName || clientEmail,
        drive_folder_id: newFolder.id,
        drive_folder_link: clientFolderLink,
      });
    }

    // Create subfolder with session date
    const subfolderName = sessionDate || new Date().toISOString().split("T")[0];
    
    const createSubfolderResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: subfolderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [clientFolderId],
      }),
    });

    const subfolder = await createSubfolderResponse.json();
    if (!createSubfolderResponse.ok) {
      throw new Error(`Failed to create subfolder: ${JSON.stringify(subfolder)}`);
    }

    const subfolderLink = `https://drive.google.com/drive/folders/${subfolder.id}`;

    console.log("[CREATE-SUBFOLDER] Subfolder created:", subfolderLink);

    return new Response(
      JSON.stringify({ 
        success: true,
        clientFolderLink,
        subfolderLink,
        subfolderId: subfolder.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[CREATE-SUBFOLDER] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
