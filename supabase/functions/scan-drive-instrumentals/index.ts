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
    // TEMPORARILY SKIP AUTH FOR TESTING
    const authHeader = req.headers.get("authorization");
    let userEmail = "anonymous";
    
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (user) {
        userEmail = user.email || "unknown";
      }
    }
    
    console.log("[SCAN] Request from:", userEmail);

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
    // Include modifiedTime to detect updated files
    const listResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${INSTRUMENTALS_FOLDER_ID}'+in+parents&fields=files(id,name,mimeType,createdTime,modifiedTime,size)`,
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
      .select("id, drive_file_id, title, has_stems, stems_folder_id, drive_modified_at");

    if (dbError) {
      console.error("DB error:", dbError);
      throw new Error("Database error");
    }

    const existingDriveIds = new Set(existingInstrumentals?.map(i => i.drive_file_id) || []);
    
    // Create a Set of all drive file IDs from Google Drive
    const driveFileIds = new Set(audioFiles.map((f: any) => f.id));
    
    // ========== DELETION: Find instrumentals in DB that no longer exist in Drive ==========
    const deletedFromDrive: string[] = [];
    for (const instrumental of existingInstrumentals || []) {
      if (instrumental.drive_file_id && !driveFileIds.has(instrumental.drive_file_id)) {
        // This file no longer exists in Google Drive - DELETE from Supabase
        console.log(`[DELETE] File removed from Drive: ${instrumental.title} (${instrumental.drive_file_id})`);
        
        const { error: deleteError } = await supabase
          .from("instrumentals")
          .delete()
          .eq("id", instrumental.id);
        
        if (deleteError) {
          console.error(`Failed to delete ${instrumental.title}:`, deleteError);
        } else {
          deletedFromDrive.push(instrumental.title);
          console.log(`Deleted from database: ${instrumental.title}`);
        }
      }
    }

    // Map audio files with stems folder info
    const driveFilesWithStatus = audioFiles.map((file: any) => {
      const numericPrefix = extractNumericPrefix(file.name);
      const stemsFolder = numericPrefix ? stemsFolderMap[numericPrefix] : null;
      
      return {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        size: file.size,
        isInDatabase: existingDriveIds.has(file.id),
        hasStemsFolder: !!stemsFolder,
        stemsFolderId: stemsFolder?.id || null,
        stemsFolderName: stemsFolder?.name || null,
      };
    });

    // ========== UPDATE: Check for modified files and update stems info ==========
    const updatedFiles: string[] = [];
    for (const instrumental of existingInstrumentals || []) {
      const driveFile = driveFilesWithStatus.find((f: any) => f.id === instrumental.drive_file_id);
      if (!driveFile) continue; // Already deleted above
      
      // Check if file was modified in Drive (date changed)
      const driveModifiedAt = driveFile.modifiedTime ? new Date(driveFile.modifiedTime).toISOString() : null;
      const dbModifiedAt = instrumental.drive_modified_at;
      
      const needsUpdate = 
        instrumental.has_stems !== driveFile.hasStemsFolder ||
        instrumental.stems_folder_id !== driveFile.stemsFolderId ||
        (driveModifiedAt && driveModifiedAt !== dbModifiedAt);
      
      if (needsUpdate) {
        // Re-parse title, BPM, key from new filename if file was replaced
        const bpmMatch = driveFile.name.match(/(\d+)\s*bpm/i);
        const bpm = bpmMatch ? parseInt(bpmMatch[1]) : null;
        
        const keyMatch = driveFile.name.match(/([a-gA-G])\s*(min|maj|minor|major)?/i);
        const key = keyMatch ? `${keyMatch[1].toUpperCase()} ${keyMatch[2]?.toLowerCase() || 'minor'}` : null;
        
        const title = driveFile.name.replace(/\.(mp3|wav|flac|m4a)$/i, '').trim();
        
        const updateData: any = {
          has_stems: driveFile.hasStemsFolder,
          stems_folder_id: driveFile.stemsFolderId,
          drive_modified_at: driveModifiedAt,
        };
        
        // Only update title/bpm/key if the file was actually modified (not just stems info)
        if (driveModifiedAt && driveModifiedAt !== dbModifiedAt) {
          updateData.title = title;
          if (bpm) updateData.bpm = bpm;
          if (key) updateData.key = key;
          console.log(`[UPDATE] File was modified in Drive: ${instrumental.title} -> ${title}`);
        }
        
        await supabase
          .from("instrumentals")
          .update(updateData)
          .eq("drive_file_id", instrumental.drive_file_id);
        
        updatedFiles.push(driveFile.name);
        console.log(`Updated: ${driveFile.name}`);
      }
    }

    // AUTO-INSERT: Add new files to database automatically
    const newFiles = driveFilesWithStatus.filter((f: any) => !f.isInDatabase);
    const insertedFiles: string[] = [];
    
    for (const file of newFiles) {
      // Parse BPM from filename (e.g., "1280 e min 125 bpm.wav" -> 125)
      const bpmMatch = file.name.match(/(\d+)\s*bpm/i);
      const bpm = bpmMatch ? parseInt(bpmMatch[1]) : null;
      
      // Parse key from filename (e.g., "e min", "D MIN")
      const keyMatch = file.name.match(/([a-gA-G])\s*(min|maj|minor|major)?/i);
      const key = keyMatch ? `${keyMatch[1].toUpperCase()} ${keyMatch[2]?.toLowerCase() || 'minor'}` : null;
      
      // Clean title
      const title = file.name.replace(/\.(mp3|wav|flac|m4a)$/i, '').trim();
      
      const { error: insertError } = await supabase
        .from("instrumentals")
        .insert({
          title,
          bpm,
          key,
          genre: 'Beat',
          drive_file_id: file.id,
          has_stems: file.hasStemsFolder,
          stems_folder_id: file.stemsFolderId,
          is_active: true,
          drive_modified_at: file.modifiedTime,
        });
      
      if (insertError) {
        console.error(`Failed to insert ${file.name}:`, insertError);
      } else {
        console.log(`Inserted: ${title}`);
        insertedFiles.push(title);
      }
    }

    return new Response(
      JSON.stringify({ 
        files: driveFilesWithStatus,
        totalInDrive: audioFiles.length,
        totalInDatabase: existingInstrumentals?.length || 0,
        newFiles: newFiles.length,
        insertedFiles,
        deletedFiles: deletedFromDrive,
        updatedFiles,
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
