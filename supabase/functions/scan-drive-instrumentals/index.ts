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
    .in("role", ["admin", "superadmin"])
    .maybeSingle();
  
  if (error) {
    console.error("[ADMIN] Error checking admin role:", error);
    return false;
  }
  
  return !!data;
}

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

// Folder ID for instrumentals (from environment variable or default)
const INSTRUMENTALS_FOLDER_ID = Deno.env.get("GOOGLE_DRIVE_INSTRUMENTALS_FOLDER_ID") || "1fo_SnmEfdSM2PDv90ujDUzkDhR3KRUVu";

// Helper to extract numeric prefix from file name (e.g., "1278" from "1278 - Beat Name.mp3")
function extractNumericPrefix(fileName: string): string | null {
  const match = fileName.match(/^(\d+)/);
  return match ? match[1] : null;
}

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

    // Check if user is admin via database role check
    const hasAdminRole = await isUserAdmin(user.id);
    if (!hasAdminRole) {
      console.log("[SCAN] User lacks admin role:", user.email);
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

    // List all items in the folder (audio files AND folders for stems)
    const listResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${INSTRUMENTALS_FOLDER_ID}'+in+parents&fields=files(id,name,mimeType,createdTime,size)`,
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
    const allItems = listData.files || [];

    // Separate audio files and folders
    const audioFiles = allItems.filter((item: any) => 
      item.mimeType?.includes('audio') || 
      /\.(mp3|wav|flac|m4a)$/i.test(item.name)
    );
    
    // Find stems folders (pattern: "#### ppp" where #### is a number)
    const stemsFolders = allItems.filter((item: any) => 
      item.mimeType === 'application/vnd.google-apps.folder' &&
      /^\d+\s+ppp$/i.test(item.name.trim())
    );

    console.log(`Found ${audioFiles.length} audio files and ${stemsFolders.length} stems folders`);

    // Create a map of stems folders by their numeric prefix
    const stemsFolderMap: Record<string, { id: string; name: string }> = {};
    for (const folder of stemsFolders) {
      const prefix = folder.name.match(/^(\d+)/)?.[1];
      if (prefix) {
        stemsFolderMap[prefix] = { id: folder.id, name: folder.name };
        console.log(`Stems folder found: ${folder.name} -> prefix ${prefix}`);
      }
    }

    // Get existing instrumentals from database
    const { data: existingInstrumentals, error: dbError } = await supabase
      .from("instrumentals")
      .select("drive_file_id, title, has_stems, stems_folder_id");

    if (dbError) {
      console.error("DB error:", dbError);
      throw new Error("Database error");
    }

    const existingDriveIds = new Set(existingInstrumentals?.map(i => i.drive_file_id) || []);

    // Map audio files with stems folder info
    const driveFilesWithStatus = audioFiles.map((file: any) => {
      const numericPrefix = extractNumericPrefix(file.name);
      const stemsFolder = numericPrefix ? stemsFolderMap[numericPrefix] : null;
      
      return {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        createdTime: file.createdTime,
        size: file.size,
        isInDatabase: existingDriveIds.has(file.id),
        hasStemsFolder: !!stemsFolder,
        stemsFolderId: stemsFolder?.id || null,
        stemsFolderName: stemsFolder?.name || null,
      };
    });

    // Update existing instrumentals with stems info if changed
    for (const instrumental of existingInstrumentals || []) {
      const driveFile = driveFilesWithStatus.find((f: any) => f.id === instrumental.drive_file_id);
      if (driveFile && (
        instrumental.has_stems !== driveFile.hasStemsFolder ||
        instrumental.stems_folder_id !== driveFile.stemsFolderId
      )) {
        await supabase
          .from("instrumentals")
          .update({
            has_stems: driveFile.hasStemsFolder,
            stems_folder_id: driveFile.stemsFolderId
          })
          .eq("drive_file_id", instrumental.drive_file_id);
        console.log(`Updated stems info for: ${instrumental.title}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        files: driveFilesWithStatus,
        totalInDrive: audioFiles.length,
        totalInDatabase: existingInstrumentals?.length || 0,
        newFiles: driveFilesWithStatus.filter((f: any) => !f.isInDatabase).length,
        stemsFoldersFound: stemsFolders.length,
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
