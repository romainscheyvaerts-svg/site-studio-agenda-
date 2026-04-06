import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function isUserAdmin(userId: string, studioId?: string): Promise<boolean> {
  const { data: platformRoles } = await supabase
    .from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "superadmin"]);
  if (platformRoles && platformRoles.length > 0) return true;
  if (studioId) {
    const { data: studioRole } = await supabase
      .from("studio_members").select("role").eq("user_id", userId).eq("studio_id", studioId)
      .in("role", ["owner", "admin"]).maybeSingle();
    if (studioRole) return true;
  } else {
    const { data: anyRole } = await supabase
      .from("studio_members").select("role").eq("user_id", userId).in("role", ["owner", "admin"]).limit(1);
    if (anyRole && anyRole.length > 0) return true;
  }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: userData, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { eventId, studioId } = await req.json();
    
    if (!eventId) {
      return new Response(JSON.stringify({ error: "Missing eventId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const hasAdminRole = await isUserAdmin(userData.user.id, studioId);
    if (!hasAdminRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("[DELETE-EVENT] Deleting event:", eventId);

    // Delete from studio_events
    const { error: deleteError } = await supabase
      .from("studio_events")
      .delete()
      .eq("id", eventId);

    if (deleteError) {
      console.error("[DELETE-EVENT] DB error:", deleteError);
      return new Response(JSON.stringify({ error: "Failed to delete", details: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Also clean up session_assignments
    try {
      await supabase.from("session_assignments").delete().eq("google_event_id", eventId);
    } catch (_e) { /* ignore */ }

    console.log("[DELETE-EVENT] Event deleted successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Event deleted" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[DELETE-EVENT] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
