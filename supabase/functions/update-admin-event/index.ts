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

    const body = await req.json();
    const { eventId, title, clientName, clientEmail, description, date, time, hours, colorId, assignedAdminId, serviceType, totalPrice, studioId } = body;
    
    if (!eventId) {
      return new Response(JSON.stringify({ error: "Missing eventId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const hasAdminRole = await isUserAdmin(userData.user.id, studioId);
    if (!hasAdminRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build update object (only include fields that were provided)
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    
    if (title !== undefined) updateData.title = title;
    if (clientName !== undefined) updateData.client_name = clientName;
    if (clientEmail !== undefined) updateData.client_email = clientEmail;
    if (description !== undefined) updateData.description = description;
    if (colorId !== undefined) updateData.color_id = colorId;
    if (assignedAdminId !== undefined) updateData.assigned_admin_id = assignedAdminId;
    if (serviceType !== undefined) updateData.service_type = serviceType;
    if (totalPrice !== undefined) updateData.total_price = totalPrice;

    if (date && time) {
      const [hour, minute] = time.split(":").map(Number);
      const durationHours = hours || 2;
      let endHour = hour + durationHours;
      let endMinute = minute || 0;
      if (endHour >= 24) { endHour = 23; endMinute = 59; }
      
      updateData.event_date = date;
      updateData.start_time = `${String(hour).padStart(2, "0")}:${String(minute || 0).padStart(2, "0")}`;
      updateData.end_time = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
      updateData.duration_hours = durationHours;
    }

    console.log("[UPDATE-EVENT] Updating event:", eventId, updateData);

    const { data: updated, error: updateError } = await supabase
      .from("studio_events")
      .update(updateData)
      .eq("id", eventId)
      .select()
      .single();

    if (updateError) {
      console.error("[UPDATE-EVENT] DB error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update session assignment if admin changed
    if (assignedAdminId) {
      try {
        await supabase.from("session_assignments").upsert({
          google_event_id: eventId,
          admin_user_id: assignedAdminId,
          assigned_at: new Date().toISOString(),
        }, { onConflict: "google_event_id" });
      } catch (_e) { /* ignore */ }
    }

    console.log("[UPDATE-EVENT] Event updated successfully");

    return new Response(
      JSON.stringify({ success: true, event: updated, message: "Event updated" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[UPDATE-EVENT] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
