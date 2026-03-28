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
  // Safe base64url encoding (avoids spread operator stack overflow on large arrays)
  const base64url = (data: Uint8Array) => {
    let binary = "";
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  };
  
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
    throw new Error("Échec d'authentification Google. Vérifiez la clé de service.");
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

// List ALL files from Google Drive with pagination support
async function listAllDriveFiles(accessToken: string, folderId: string): Promise<any[]> {
  const allFiles: any[] = [];
  let pageToken: string | undefined = undefined;
  
  do {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
    url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,size)");
    url.searchParams.set("pageSize", "1000");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }
    
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to list drive files:", response.status, errorText);
      throw new Error(`Erreur Google Drive (${response.status}): impossible de lister les fichiers du dossier.`);
    }

    const data = await response.json();
    allFiles.push(...(data.files || []));
    pageToken = data.nextPageToken;
    
    console.log(`[DRIVE] Fetched ${data.files?.length || 0} items (total: ${allFiles.length}), hasMore: ${!!pageToken}`);
  } while (pageToken);
  
  return allFiles;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("authorization");
    let userEmail = "anonymous";
    
    if (authHeader) {
      try {
        const { data: { user } } = await supabase.auth.getUser(
          authHeader.replace("Bearer ", "")
        );
        if (user) {
          userEmail = user.email || "unknown";
        }
      } catch (authErr) {
        console.warn("[AUTH] Could not verify user token:", authErr);
      }
    }
    
    console.log("[SCAN] Request from:", userEmail);

    // Get Google credentials
    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountKey) {
      console.error("Missing GOOGLE_SERVICE_ACCOUNT_KEY environment variable");
      return new Response(JSON.stringify({ 
        error: "Configuration manquante: GOOGLE_SERVICE_ACCOUNT_KEY n'est pas défini dans les secrets Supabase." 
      }), {
        status: 200, // Return 200 with error in body so client can read it
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate that the key is valid JSON
    try {
      const parsedKey = JSON.parse(serviceAccountKey);
      if (!parsedKey.client_email || !parsedKey.private_key) {
        return new Response(JSON.stringify({ 
          error: "La clé de service Google est incomplète (client_email ou private_key manquant)." 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (parseErr) {
      console.error("Invalid GOOGLE_SERVICE_ACCOUNT_KEY JSON:", parseErr);
      return new Response(JSON.stringify({ 
        error: "La clé de service Google n'est pas un JSON valide. Vérifiez le format dans les secrets Supabase." 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get access token
    let accessToken: string;
    try {
      accessToken = await getAccessToken(serviceAccountKey, [
        "https://www.googleapis.com/auth/drive.readonly",
      ]);
    } catch (tokenErr) {
      console.error("Failed to get Google access token:", tokenErr);
      return new Response(JSON.stringify({ 
        error: `Impossible d'obtenir un token Google: ${tokenErr instanceof Error ? tokenErr.message : "erreur inconnue"}` 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[SCAN] Got Google access token, listing files from folder:", INSTRUMENTALS_FOLDER_ID);

    // List all items in the folder with pagination
    let allItems: any[];
    try {
      allItems = await listAllDriveFiles(accessToken, INSTRUMENTALS_FOLDER_ID);
    } catch (driveErr) {
      console.error("Failed to list drive files:", driveErr);
      return new Response(JSON.stringify({ 
        error: `${driveErr instanceof Error ? driveErr.message : "Impossible de lister les fichiers Google Drive."}` 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    console.log(`[SCAN] Found ${audioFiles.length} audio files and ${stemsFolders.length} stems folders (total items: ${allItems.length})`);

    // Create a map of stems folders by their numeric prefix
    const stemsFolderMap: Record<string, { id: string; name: string }> = {};
    for (const folder of stemsFolders) {
      const prefix = folder.name.match(/^(\d+)/)?.[1];
      if (prefix) {
        stemsFolderMap[prefix] = { id: folder.id, name: folder.name };
      }
    }

    // Get existing instrumentals from database
    const { data: existingInstrumentals, error: dbError } = await supabase
      .from("instrumentals")
      .select("id, drive_file_id, title, has_stems, stems_folder_id, drive_modified_at");

    if (dbError) {
      console.error("DB error fetching instrumentals:", dbError);
      return new Response(JSON.stringify({ 
        error: `Erreur base de données: ${dbError.message}` 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existingDriveIds = new Set(existingInstrumentals?.map(i => i.drive_file_id) || []);
    
    // Create a Set of all drive file IDs from Google Drive
    const driveFileIds = new Set(audioFiles.map((f: any) => f.id));
    
    // ========== DELETION: Find instrumentals in DB that no longer exist in Drive ==========
    const deletedFromDrive: string[] = [];
    const toDelete = (existingInstrumentals || []).filter(
      instrumental => instrumental.drive_file_id && !driveFileIds.has(instrumental.drive_file_id)
    );
    
    if (toDelete.length > 0) {
      const deleteIds = toDelete.map(i => i.id);
      console.log(`[DELETE] Removing ${toDelete.length} files no longer in Drive:`, toDelete.map(i => i.title));
      
      const { error: deleteError } = await supabase
        .from("instrumentals")
        .delete()
        .in("id", deleteIds);
      
      if (deleteError) {
        console.error("Failed to batch delete:", deleteError);
      } else {
        deletedFromDrive.push(...toDelete.map(i => i.title));
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
    // IMPORTANT: Never overwrite user-editable fields (title, description, genre, bpm, key)
    // Only update technical/Drive-related fields (has_stems, stems_folder_id, drive_modified_at)
    const updatedFiles: string[] = [];
    const updatePromises: Promise<void>[] = [];
    
    for (const instrumental of existingInstrumentals || []) {
      const driveFile = driveFilesWithStatus.find((f: any) => f.id === instrumental.drive_file_id);
      if (!driveFile) continue; // Already deleted above
      
      const driveModifiedAt = driveFile.modifiedTime ? new Date(driveFile.modifiedTime).toISOString() : null;
      const dbModifiedAt = instrumental.drive_modified_at;
      
      const needsUpdate = 
        instrumental.has_stems !== driveFile.hasStemsFolder ||
        instrumental.stems_folder_id !== driveFile.stemsFolderId ||
        (driveModifiedAt && driveModifiedAt !== dbModifiedAt);
      
      if (needsUpdate) {
        // Only update technical fields - NEVER overwrite title, bpm, key, genre, description
        // These are manually edited by the admin on the site and must be preserved
        const updateData: any = {
          has_stems: driveFile.hasStemsFolder,
          stems_folder_id: driveFile.stemsFolderId,
          drive_modified_at: driveModifiedAt,
        };
        
        updatePromises.push(
          supabase
            .from("instrumentals")
            .update(updateData)
            .eq("drive_file_id", instrumental.drive_file_id)
            .then(({ error }) => {
              if (error) {
                console.error(`Failed to update ${driveFile.name}:`, error);
              } else {
                updatedFiles.push(driveFile.name);
              }
            })
        );
      }
    }
    
    // Execute all updates in parallel
    if (updatePromises.length > 0) {
      console.log(`[UPDATE] Updating ${updatePromises.length} files...`);
      await Promise.all(updatePromises);
    }

    // ========== INSERT: Add new files to database ==========
    const newFiles = driveFilesWithStatus.filter((f: any) => !f.isInDatabase);
    const insertedFiles: string[] = [];
    
    if (newFiles.length > 0) {
      // Batch insert all new files at once
      const insertData = newFiles.map((file: any) => {
        const bpmMatch = file.name.match(/(\d+)\s*bpm/i);
        const bpm = bpmMatch ? parseInt(bpmMatch[1]) : null;
        
        // Improved key detection: handles sharps (#), flats (b), and various formats
        // Examples: "d# min", "C#m", "Ab major", "Fm", "d# minor", "Bb min"
        const keyMatch = file.name.match(/\b([a-gA-G][#b]?)\s*(min|maj|minor|major|m(?!\w))?/i);
        let key: string | null = null;
        if (keyMatch) {
          const note = keyMatch[1].charAt(0).toUpperCase() + keyMatch[1].slice(1);
          const quality = keyMatch[2] || 'minor';
          const normalizedQuality = quality.startsWith('maj') ? 'major' : 'minor';
          key = `${note} ${normalizedQuality}`;
        }
        
        const title = file.name.replace(/\.(mp3|wav|flac|m4a)$/i, '').trim();
        
        return {
          title,
          bpm,
          key,
          genre: 'Trap',
          drive_file_id: file.id,
          has_stems: file.hasStemsFolder,
          stems_folder_id: file.stemsFolderId,
          is_active: false,
          drive_modified_at: file.modifiedTime,
        };
      });
      
      console.log(`[INSERT] Inserting ${insertData.length} new files...`);
      
      // Insert in batches of 50 to avoid payload limits
      const BATCH_SIZE = 50;
      for (let i = 0; i < insertData.length; i += BATCH_SIZE) {
        const batch = insertData.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase
          .from("instrumentals")
          .insert(batch);
        
        if (insertError) {
          console.error(`Failed to insert batch ${i / BATCH_SIZE + 1}:`, insertError);
          // Try inserting one by one for this failed batch
          for (const item of batch) {
            const { error: singleError } = await supabase
              .from("instrumentals")
              .insert(item);
            if (singleError) {
              console.error(`Failed to insert ${item.title}:`, singleError);
            } else {
              insertedFiles.push(item.title);
            }
          }
        } else {
          insertedFiles.push(...batch.map(b => b.title));
          console.log(`[INSERT] Batch ${i / BATCH_SIZE + 1} inserted successfully (${batch.length} files)`);
        }
      }
    }

    console.log(`[SCAN] Complete - New: ${insertedFiles.length}, Updated: ${updatedFiles.length}, Deleted: ${deletedFromDrive.length}`);

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
    // IMPORTANT: Return 200 with error in body so supabase.functions.invoke() 
    // can pass the actual error message to the client instead of generic "non-2xx" error
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erreur inconnue lors du scan",
        files: [],
        totalInDrive: 0,
        totalInDatabase: 0,
        newFiles: 0,
        insertedFiles: [],
        deletedFiles: [],
        updatedFiles: [],
        stemsFoldersFound: 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
