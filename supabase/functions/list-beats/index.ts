import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_DRIVE_API_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY");
const FOLDER_ID = "1HGcJhaoJaljsSp9156iGOUhHdJ1KwsQ9";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[LIST-BEATS] Fetching beats from Google Drive folder");

    if (!GOOGLE_DRIVE_API_KEY) {
      console.error("[LIST-BEATS] Missing GOOGLE_DRIVE_API_KEY");
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Query Google Drive API for audio files in the folder
    const query = `'${FOLDER_ID}' in parents and trashed = false and (mimeType contains 'audio/' or mimeType = 'application/octet-stream')`;
    const fields = "files(id,name,mimeType,size,webContentLink,webViewLink,createdTime)";
    
    const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&key=${GOOGLE_DRIVE_API_KEY}`;
    
    console.log("[LIST-BEATS] Calling Google Drive API");
    
    const response = await fetch(driveUrl);
    const data = await response.json();

    if (!response.ok) {
      console.error("[LIST-BEATS] Google Drive API error:", data);
      return new Response(
        JSON.stringify({ error: "Failed to fetch files from Google Drive", details: data.error?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const beats = (data.files || []).map((file: any) => ({
      id: file.id,
      name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension for display
      fileName: file.name,
      mimeType: file.mimeType,
      size: file.size ? parseInt(file.size) : 0,
      previewUrl: `https://drive.google.com/uc?export=preview&id=${file.id}`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
      webViewLink: file.webViewLink,
      createdTime: file.createdTime,
      price: 50, // Default price
    }));

    console.log(`[LIST-BEATS] Found ${beats.length} beats`);

    return new Response(
      JSON.stringify({ beats }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[LIST-BEATS] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
