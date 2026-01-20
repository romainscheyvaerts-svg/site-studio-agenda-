import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Créer le client admin
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // SÉCURITÉ: Vérifier le token avec supabase.auth.getUser() au lieu de décodage manuel
    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerId = userData.user.id;

    // Vérifier si l'appelant est un superadmin dans la BDD (pas d'email hardcodé)
    const { data: callerRoleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "superadmin");

    const isCallerSuperAdmin = callerRoleData && callerRoleData.length > 0;

    if (!isCallerSuperAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: "Super admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { targetUserId, action } = await req.json();

    if (!targetUserId || !["add", "remove"].includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Récupérer l'utilisateur cible
    const { data: targetUserData, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);

    if (targetUserError || !targetUserData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Vérifier si la cible est un superadmin (protection)
    const { data: targetRoleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", targetUserId)
      .eq("role", "superadmin");

    const isTargetSuperAdmin = targetRoleData && targetRoleData.length > 0;

    // Empêcher la modification des rôles des super admins
    if (isTargetSuperAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: "Cannot modify super admin roles" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "add") {
      // Ajouter le rôle admin
      const { error: insertError } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: targetUserId, role: "admin" },
          { onConflict: "user_id,role" }
        );

      if (insertError) {
        throw insertError;
      }
    } else {
      // Retirer le rôle admin
      const { error: deleteError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId)
        .eq("role", "admin");

      if (deleteError) {
        throw deleteError;
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
