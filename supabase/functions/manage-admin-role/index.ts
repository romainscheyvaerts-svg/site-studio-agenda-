import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPER_ADMIN_EMAILS = ["prod.makemusic@gmail.com", "romain.scheyvaerts@gmail.com"];

serve(async (req) => {
  console.log("[MANAGE-ADMIN-ROLE] Request received");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.log("[MANAGE-ADMIN-ROLE] No auth header");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // Verify the caller
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    
    if (userError || !user) {
      console.log("[MANAGE-ADMIN-ROLE] User auth failed");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is a super admin
    const callerEmail = user.email?.toLowerCase() || "";
    console.log("[MANAGE-ADMIN-ROLE] Caller email:", callerEmail);

    if (!SUPER_ADMIN_EMAILS.includes(callerEmail)) {
      console.log("[MANAGE-ADMIN-ROLE] Not a super admin");
      return new Response(
        JSON.stringify({ success: false, error: "Super admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { targetUserId, action } = await req.json();
    console.log("[MANAGE-ADMIN-ROLE] Action:", action, "Target:", targetUserId);

    if (!targetUserId || !["add", "remove"].includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get target user's email to check if they're a super admin
    const { data: targetUserData, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
    
    if (targetUserError || !targetUserData?.user) {
      console.log("[MANAGE-ADMIN-ROLE] Target user not found");
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetEmail = targetUserData.user.email?.toLowerCase() || "";
    
    // Prevent modifying super admin roles
    if (SUPER_ADMIN_EMAILS.includes(targetEmail)) {
      console.log("[MANAGE-ADMIN-ROLE] Cannot modify super admin");
      return new Response(
        JSON.stringify({ success: false, error: "Cannot modify super admin roles" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "add") {
      // Add admin role
      const { error: insertError } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: targetUserId, role: "admin" },
          { onConflict: "user_id,role" }
        );

      if (insertError) {
        console.log("[MANAGE-ADMIN-ROLE] Insert error:", insertError);
        throw insertError;
      }

      console.log("[MANAGE-ADMIN-ROLE] Admin role added for:", targetEmail);
    } else {
      // Remove admin role
      const { error: deleteError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId)
        .eq("role", "admin");

      if (deleteError) {
        console.log("[MANAGE-ADMIN-ROLE] Delete error:", deleteError);
        throw deleteError;
      }

      console.log("[MANAGE-ADMIN-ROLE] Admin role removed for:", targetEmail);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[MANAGE-ADMIN-ROLE] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
