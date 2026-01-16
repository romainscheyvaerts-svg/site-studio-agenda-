import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPER_ADMIN_EMAILS = ["prod.makemusic@gmail.com", "romain.scheyvaerts@gmail.com"];

// Décoder le JWT manuellement pour extraire l'ID utilisateur
function getUserIdFromJwt(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Décodage Base64 Url Safe
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const json = JSON.parse(decoded);
    return json.sub; // 'sub' est l'ID de l'utilisateur
  } catch (e) {
    console.error("[MANAGE-ADMIN-ROLE] Erreur décodage JWT:", e);
    return null;
  }
}

// Extraire l'email du JWT
function getEmailFromJwt(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const json = JSON.parse(decoded);
    return json.email || null;
  } catch (e) {
    console.error("[MANAGE-ADMIN-ROLE] Erreur extraction email JWT:", e);
    return null;
  }
}

serve(async (req) => {
  console.log("[MANAGE-ADMIN-ROLE] Request received");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader) {
      console.log("[MANAGE-ADMIN-ROLE] No auth header");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Décoder manuellement le JWT (bypass auth.getUser() qui peut échouer)
    const callerId = getUserIdFromJwt(token);
    const callerEmail = getEmailFromJwt(token);

    console.log("[MANAGE-ADMIN-ROLE] Caller ID:", callerId);
    console.log("[MANAGE-ADMIN-ROLE] Caller email:", callerEmail);

    if (!callerId) {
      console.log("[MANAGE-ADMIN-ROLE] Invalid token format");
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token format" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Vérifier si l'appelant est un super admin
    const isCallerSuperAdmin = SUPER_ADMIN_EMAILS.includes(callerEmail?.toLowerCase() || "");
    console.log("[MANAGE-ADMIN-ROLE] Is caller super admin:", isCallerSuperAdmin);

    if (!isCallerSuperAdmin) {
      console.log("[MANAGE-ADMIN-ROLE] Not a super admin");
      return new Response(
        JSON.stringify({ success: false, error: "Super admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Créer le client admin
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { targetUserId, action } = await req.json();
    console.log("[MANAGE-ADMIN-ROLE] Action:", action, "Target:", targetUserId);

    if (!targetUserId || !["add", "remove"].includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Récupérer l'email de l'utilisateur cible pour vérifier si c'est un super admin
    const { data: targetUserData, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);

    if (targetUserError || !targetUserData?.user) {
      console.log("[MANAGE-ADMIN-ROLE] Target user not found");
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetEmail = targetUserData.user.email?.toLowerCase() || "";

    // Empêcher la modification des rôles des super admins
    if (SUPER_ADMIN_EMAILS.includes(targetEmail)) {
      console.log("[MANAGE-ADMIN-ROLE] Cannot modify super admin");
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
        console.log("[MANAGE-ADMIN-ROLE] Insert error:", insertError);
        throw insertError;
      }

      console.log("[MANAGE-ADMIN-ROLE] Admin role added for:", targetEmail);
    } else {
      // Retirer le rôle admin
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
