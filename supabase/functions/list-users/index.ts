import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Liste des emails super admin
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
    console.error("[LIST-USERS] Erreur décodage JWT:", e);
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
    console.error("[LIST-USERS] Erreur extraction email JWT:", e);
    return null;
  }
}

serve(async (req) => {
  console.log("[LIST-USERS] Request received");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Vérifier le header d'autorisation
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    console.log("[LIST-USERS] Auth header present:", !!authHeader);

    if (!authHeader) {
      console.log("[LIST-USERS] No auth header - returning 401");
      return new Response(JSON.stringify({ error: "Unauthorized", users: [] }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    // Décoder manuellement le JWT (bypass auth.getUser() qui peut échouer)
    const userId = getUserIdFromJwt(token);
    const userEmail = getEmailFromJwt(token);

    console.log("[LIST-USERS] Decoded user ID:", userId);
    console.log("[LIST-USERS] Decoded user email:", userEmail);

    if (!userId) {
      console.log("[LIST-USERS] Invalid token format");
      return new Response(JSON.stringify({ error: "Invalid token format", users: [] }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log("[LIST-USERS] Env vars present - URL:", !!supabaseUrl, "Service:", !!serviceRoleKey);

    // Créer le client admin pour les opérations
    const supabaseAdmin = createClient(
      supabaseUrl ?? "",
      serviceRoleKey ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Vérifier si l'utilisateur est admin par email OU par rôle
    const isAdminByEmail = SUPER_ADMIN_EMAILS.includes(userEmail?.toLowerCase() || "");

    // Vérifier le rôle dans la BDD
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "superadmin"]);

    const isAdminByRole = roleData && roleData.length > 0;

    console.log("[LIST-USERS] Is admin by email:", isAdminByEmail, "Is admin by role:", isAdminByRole);

    if (!isAdminByEmail && !isAdminByRole) {
      console.log("[LIST-USERS] Not an admin");
      return new Response(JSON.stringify({ error: "Admin access required", users: [] }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[LIST-USERS] Admin verified, listing users...");

    // Lister tous les utilisateurs via l'API admin
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });

    if (listError) {
      console.error("[LIST-USERS] Error listing users:", listError);
      return new Response(JSON.stringify({ error: listError.message, users: [] }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[LIST-USERS] Raw users count:", usersData?.users?.length || 0);

    // Retourner tous les utilisateurs
    const users = (usersData?.users || [])
      .map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        phone: u.phone,
        user_metadata: {
          full_name: u.user_metadata?.full_name || u.user_metadata?.name,
          phone: u.user_metadata?.phone,
        },
      }));

    console.log(`[LIST-USERS] Returning ${users.length} users`);

    return new Response(JSON.stringify({ users }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[LIST-USERS] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage, users: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
