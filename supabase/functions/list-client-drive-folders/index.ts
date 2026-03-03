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
    // Get authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Create client with user token to verify admin status
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user from token
    const { data: userData, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userEmail = userData.user.email?.toLowerCase().trim();

    // Check if user is admin
    const { data: adminData } = await supabaseAdmin
      .from("admin_users")
      .select("id")
      .eq("email", userEmail)
      .maybeSingle();

    if (!adminData) {
      return new Response(
        JSON.stringify({ error: "Not authorized - admin only" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[LIST-CLIENT-FOLDERS] Admin verified:", userEmail);

    // Fetch all client folders using service role (bypasses RLS)
    const { data: folders, error: foldersError } = await supabaseAdmin
      .from("client_drive_folders")
      .select("*")
      .order("client_name", { ascending: true });

    if (foldersError) {
      console.error("[LIST-CLIENT-FOLDERS] Error fetching folders:", foldersError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch folders" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[LIST-CLIENT-FOLDERS] Found", folders?.length || 0, "folders");

    return new Response(
      JSON.stringify({ 
        success: true,
        folders: folders || [],
        count: folders?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[LIST-CLIENT-FOLDERS] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
