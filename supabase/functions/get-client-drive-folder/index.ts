import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[GET-CLIENT-DRIVE-FOLDER] Starting request");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get client email from request body or auth token
    let clientEmail: string | null = null;

    // Check for authorization header (logged-in user)
    const authHeader = req.headers.get("authorization");
    console.log("[GET-CLIENT-DRIVE-FOLDER] Auth header present:", !!authHeader);
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: authError } = await supabase.auth.getUser(token);

      if (authError) {
        console.error("[GET-CLIENT-DRIVE-FOLDER] Auth error:", authError.message);
      }

      if (!authError && userData?.user?.email) {
        clientEmail = userData.user.email.toLowerCase().trim();
        console.log("[GET-CLIENT-DRIVE-FOLDER] Email from auth:", clientEmail);
      }
    }

    // Or get email from request body (for edge functions calling this)
    if (!clientEmail) {
      try {
        const body = await req.json();
        if (body.clientEmail) {
          clientEmail = body.clientEmail.toLowerCase().trim();
          console.log("[GET-CLIENT-DRIVE-FOLDER] Email from body:", clientEmail);
        }
      } catch {
        // No body or invalid JSON
        console.log("[GET-CLIENT-DRIVE-FOLDER] No body or invalid JSON");
      }
    }

    if (!clientEmail) {
      console.log("[GET-CLIENT-DRIVE-FOLDER] No email found");
      return new Response(
        JSON.stringify({ error: "Email not provided or not authenticated" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up the client's root Drive folder
    console.log("[GET-CLIENT-DRIVE-FOLDER] Looking up folder for email:", clientEmail);
    
    const { data: folderData, error: dbError } = await supabase
      .from("client_drive_folders")
      .select("drive_folder_id, drive_folder_link, client_name")
      .eq("client_email", clientEmail)
      .maybeSingle();

    if (dbError) {
      console.error("[GET-CLIENT-DRIVE-FOLDER] DB error:", dbError.message);
      throw new Error(`Database error: ${dbError.message}`);
    }

    console.log("[GET-CLIENT-DRIVE-FOLDER] Folder data found:", !!folderData);

    if (!folderData) {
      // Also try to search with ILIKE for case-insensitive matching
      const { data: ilikeFolderData, error: ilikeError } = await supabase
        .from("client_drive_folders")
        .select("drive_folder_id, drive_folder_link, client_name, client_email")
        .ilike("client_email", clientEmail)
        .maybeSingle();
      
      if (!ilikeError && ilikeFolderData) {
        console.log("[GET-CLIENT-DRIVE-FOLDER] Found folder with ilike, stored email:", ilikeFolderData.client_email);
        return new Response(
          JSON.stringify({
            found: true,
            folderId: ilikeFolderData.drive_folder_id,
            folderLink: ilikeFolderData.drive_folder_link,
            clientName: ilikeFolderData.client_name,
            clientEmail: ilikeFolderData.client_email
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({
          found: false,
          message: "No Drive folder found for this email",
          clientEmail
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[GET-CLIENT-DRIVE-FOLDER] Returning folder:", folderData.drive_folder_link);
    
    return new Response(
      JSON.stringify({
        found: true,
        folderId: folderData.drive_folder_id,
        folderLink: folderData.drive_folder_link,
        clientName: folderData.client_name,
        clientEmail
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("[GET-CLIENT-DRIVE-FOLDER] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
