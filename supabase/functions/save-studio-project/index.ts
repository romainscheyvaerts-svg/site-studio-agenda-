import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

async function getAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;

  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = btoa(JSON.stringify({
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    exp,
    iat: now,
  }));

  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  let pemContents = credentials.private_key;
  pemContents = pemContents.replace(pemHeader, "").replace(pemFooter, "").replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureInput = new TextEncoder().encode(`${header}.${claim}`);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, signatureInput);
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const jwt = `${header}.${claim}.${signatureBase64}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function findOrCreateFolder(accessToken: string, name: string, parentId?: string): Promise<string> {
  // Search for existing folder
  let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchResponse.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create new folder
  const metadata: any = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const createResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  const createData = await createResponse.json();
  return createData.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectName, projectData, userEmail, userName } = await req.json();

    if (!projectName || !projectData) {
      return new Response(
        JSON.stringify({ success: false, error: "Project name and data are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Google credentials
    const credentialsStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!credentialsStr) {
      throw new Error("Google credentials not configured");
    }

    const credentials = JSON.parse(credentialsStr);
    const accessToken = await getAccessToken(credentials);

    // Parent folder for all client folders
    const parentFolderId = "1AXGpSHUP0OyY2tWvCk573xb--Dj2jvLh";

    // Create folder structure: Client Name / sauvegarde application studio / Project Name
    const clientFolderName = userName || userEmail || "Anonymous";
    const clientFolderId = await findOrCreateFolder(accessToken, clientFolderName, parentFolderId);
    
    const studioSavesFolderId = await findOrCreateFolder(accessToken, "sauvegarde application studio", clientFolderId);
    
    const projectFolderId = await findOrCreateFolder(accessToken, projectName, studioSavesFolderId);

    // Create/update the project file
    const fileName = `${projectName}.json`;
    const fileContent = JSON.stringify(projectData, null, 2);
    
    // Check if file already exists
    const searchQuery = `name='${fileName}' and '${projectFolderId}' in parents and trashed=false`;
    const existingFileResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const existingFileData = await existingFileResponse.json();

    let fileId: string;

    if (existingFileData.files && existingFileData.files.length > 0) {
      // Update existing file
      fileId = existingFileData.files[0].id;
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: fileContent,
      });
    } else {
      // Create new file
      const metadata = {
        name: fileName,
        parents: [projectFolderId],
        mimeType: "application/json",
      };

      const boundary = "-------314159265358979323846";
      const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${fileContent}\r\n--${boundary}--`;

      const uploadResponse = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body,
        }
      );

      const uploadData = await uploadResponse.json();
      fileId = uploadData.id;
    }

    const folderLink = `https://drive.google.com/drive/folders/${projectFolderId}`;

    console.log(`Project saved: ${projectName} for ${clientFolderName}`);

    return new Response(
      JSON.stringify({
        success: true,
        fileId,
        folderId: projectFolderId,
        folderLink,
        message: `Projet sauvegardé dans: ${clientFolderName}/sauvegarde application studio/${projectName}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error saving studio project:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
