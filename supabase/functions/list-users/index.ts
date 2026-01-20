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
    // Vérifier le header d'autorisation
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized", users: [] }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Créer le client admin pour les opérations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // SÉCURITÉ: Vérifier le token avec supabase.auth.getUser() au lieu de décodage manuel
    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token", users: [] }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email;

    // Vérifier le rôle dans la BDD uniquement (plus de vérification par email hardcodé)
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "superadmin"]);

    const isAdmin = roleData && roleData.length > 0;

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required", users: [] }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lister tous les utilisateurs via l'API admin avec pagination
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });

    if (listError) {
      return new Response(JSON.stringify({ error: "Failed to list users", users: [] }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Retourner tous les utilisateurs (sans exposer de données sensibles dans les logs)
    const users = (usersData?.users || []).map((u) => ({
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

    return new Response(JSON.stringify({ users }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal server error", users: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
