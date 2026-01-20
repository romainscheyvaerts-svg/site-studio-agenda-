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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get client email from request body or auth token
    let clientEmail: string | null = null;

    // Check for authorization header (logged-in user)
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: authError } = await supabase.auth.getUser(token);

      if (!authError && userData?.user?.email) {
        clientEmail = userData.user.email.toLowerCase().trim();
      }
    }

    // Or get email from request body (for edge functions calling this)
    if (!clientEmail) {
      try {
        const body = await req.json();
        if (body.clientEmail) {
          clientEmail = body.clientEmail.toLowerCase().trim();
        }
      } catch {
        // No body or invalid JSON
      }
    }

    if (!clientEmail) {
      return new Response(
        JSON.stringify({ error: "Email not provided or not authenticated" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up the client's root Drive folder
    const { data: folderData, error: dbError } = await supabase
      .from("client_drive_folders")
      .select("drive_folder_id, drive_folder_link, client_name")
      .eq("client_email", clientEmail)
      .maybeSingle();

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    if (!folderData) {
      return new Response(
        JSON.stringify({
          found: false,
          message: "No Drive folder found for this email",
          clientEmail
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
