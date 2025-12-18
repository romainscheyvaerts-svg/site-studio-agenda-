import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log("[LIST-USERS] Request received");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin access
    const authHeader = req.headers.get("authorization");
    console.log("[LIST-USERS] Auth header present:", !!authHeader);
    
    if (!authHeader) {
      console.log("[LIST-USERS] No auth header - returning 401");
      return new Response(JSON.stringify({ error: "Unauthorized", users: [] }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    console.log("[LIST-USERS] Env vars present - URL:", !!supabaseUrl, "Service:", !!serviceRoleKey, "Anon:", !!anonKey);

    // Create admin client for auth operations
    const supabaseAdmin = createClient(
      supabaseUrl ?? "",
      serviceRoleKey ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the caller is an admin
    const supabaseUser = createClient(
      supabaseUrl ?? "",
      anonKey ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    console.log("[LIST-USERS] User lookup - found:", !!user, "error:", userError?.message);
    
    if (userError || !user) {
      console.log("[LIST-USERS] User auth failed");
      return new Response(JSON.stringify({ error: "Unauthorized", users: [] }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminEmails = ["prod.makemusic@gmail.com", "kazamzamka@gmail.com"];
    console.log("[LIST-USERS] Checking admin access for:", user.email);
    
    if (!adminEmails.includes(user.email || "")) {
      console.log("[LIST-USERS] Not an admin email");
      return new Response(JSON.stringify({ error: "Admin access required", users: [] }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[LIST-USERS] Admin verified, listing users...");

    // List all users using admin API
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

    // Filter out admin emails and format the response
    const users = (usersData?.users || [])
      .filter(u => !adminEmails.includes(u.email || ""))
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

    console.log(`[LIST-USERS] Returning ${users.length} users (after filtering admins)`);

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
