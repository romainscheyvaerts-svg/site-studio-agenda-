import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly",
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
  const metadata: Record<string, unknown> = {
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

async function listProjectsFromDrive(accessToken: string, clientFolderName: string, parentFolderId: string): Promise<{ name: string; id: string; folderId: string }[]> {
  const projects: { name: string; id: string; folderId: string }[] = [];

  // Find client folder
  const clientQuery = `name='${clientFolderName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`;
  const clientResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(clientQuery)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const clientData = await clientResponse.json();

  if (!clientData.files || clientData.files.length === 0) {
    console.log(`[LIST] No client folder found for: ${clientFolderName}`);
    return projects;
  }

  const clientFolderId = clientData.files[0].id;

  // Find "sauvegarde application studio" subfolder
  const studioQuery = `name='sauvegarde application studio' and mimeType='application/vnd.google-apps.folder' and '${clientFolderId}' in parents and trashed=false`;
  const studioResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(studioQuery)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const studioData = await studioResponse.json();

  if (!studioData.files || studioData.files.length === 0) {
    console.log("[LIST] No studio saves folder found");
    return projects;
  }

  const studioFolderId = studioData.files[0].id;

  // List all project folders
  const projectsQuery = `mimeType='application/vnd.google-apps.folder' and '${studioFolderId}' in parents and trashed=false`;
  const projectsResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(projectsQuery)}&fields=files(id,name)&orderBy=modifiedTime desc`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const projectsData = await projectsResponse.json();

  if (projectsData.files) {
    for (const folder of projectsData.files) {
      projects.push({
        name: folder.name,
        id: folder.id,
        folderId: folder.id,
      });
    }
  }

  console.log(`[LIST] Found ${projects.length} projects for ${clientFolderName}`);
  return projects;
}

async function loadProjectFromDrive(accessToken: string, projectFolderId: string): Promise<Record<string, unknown> | null> {
  // Find the JSON file in the project folder
  const fileQuery = `mimeType='application/json' and '${projectFolderId}' in parents and trashed=false`;
  const fileResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(fileQuery)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const fileData = await fileResponse.json();

  if (!fileData.files || fileData.files.length === 0) {
    console.log("[LOAD] No project file found in folder");
    return null;
  }

  const fileId = fileData.files[0].id;

  // Download file content
  const contentResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!contentResponse.ok) {
    console.error("[LOAD] Failed to download project file");
    return null;
  }

  const projectData = await contentResponse.json();
  console.log("[LOAD] Project loaded successfully");
  return projectData;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, projectName, projectData, userEmail, userName, projectFolderId } = body;

    // Get Google credentials
    const credentialsStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!credentialsStr) {
      throw new Error("Google credentials not configured");
    }

    const credentials = JSON.parse(credentialsStr);
    const accessToken = await getAccessToken(credentials);

    // Parent folder for all client folders
    const parentFolderId = "1AXGpSHUP0OyY2tWvCk573xb--Dj2jvLh";
    const clientFolderName = userName || userEmail || "Anonymous";

    // Handle different actions
    if (action === "list") {
      console.log(`[LIST] Listing projects for: ${clientFolderName}`);
      const projects = await listProjectsFromDrive(accessToken, clientFolderName, parentFolderId);
      
      return new Response(
        JSON.stringify({ success: true, projects }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "load" && projectFolderId) {
      console.log(`[LOAD] Loading project from folder: ${projectFolderId}`);
      const loadedData = await loadProjectFromDrive(accessToken, projectFolderId);
      
      if (!loadedData) {
        return new Response(
          JSON.stringify({ success: false, error: "Project not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, projectData: loadedData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default action: Save project
    if (!projectName || !projectData) {
      return new Response(
        JSON.stringify({ success: false, error: "Project name and data are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create folder structure: Client Name / sauvegarde application studio / Project Name
    const clientFolderId = await findOrCreateFolder(accessToken, clientFolderName, parentFolderId);
    
    const studioSavesFolderId = await findOrCreateFolder(accessToken, "sauvegarde application studio", clientFolderId);
    
    const projectFolderIdNew = await findOrCreateFolder(accessToken, projectName, studioSavesFolderId);

    // Create/update the project file
    const fileName = `${projectName}.json`;
    const fileContent = JSON.stringify(projectData, null, 2);
    
    // Check if file already exists
    const searchQuery = `name='${fileName}' and '${projectFolderIdNew}' in parents and trashed=false`;
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
        parents: [projectFolderIdNew],
        mimeType: "application/json",
      };

      const boundary = "-------314159265358979323846";
      const bodyContent = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${fileContent}\r\n--${boundary}--`;

      const uploadResponse = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body: bodyContent,
        }
      );

      const uploadData = await uploadResponse.json();
      fileId = uploadData.id;
    }

    const folderLink = `https://drive.google.com/drive/folders/${projectFolderIdNew}`;

    console.log(`Project saved: ${projectName} for ${clientFolderName}`);

    return new Response(
      JSON.stringify({
        success: true,
        fileId,
        folderId: projectFolderIdNew,
        folderLink,
        message: `Projet sauvegardé dans: ${clientFolderName}/sauvegarde application studio/${projectName}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in save-studio-project:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});