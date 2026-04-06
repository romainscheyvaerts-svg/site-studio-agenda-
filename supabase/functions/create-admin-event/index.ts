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

// Generate Google Calendar "Add to Calendar" link
function generateGoogleCalendarLink(title: string, date: string, startTime: string, endTime: string, description?: string): string {
  const startDt = `${date.replace(/-/g, "")}T${startTime.replace(/:/g, "")}00`;
  const endDt = `${date.replace(/-/g, "")}T${endTime.replace(/:/g, "")}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${startDt}/${endDt}`,
    ctz: "Europe/Brussels",
  });
  if (description) params.set("details", description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized", details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const user = userData.user;
    const body = await req.json();
    const { title, clientName, clientEmail, description, date, time, hours, colorId, assignedAdminId, serviceType, totalPrice, studioId } = body;

    // Admin check
    const hasAdminRole = await isUserAdmin(user.id, studioId);
    if (!hasAdminRole) {
      return new Response(JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validate
    if (!title || !date || !time) {
      return new Response(JSON.stringify({ error: "Missing required fields: title, date, time" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Calculate end time
    const [hour, minute] = time.split(":").map(Number);
    const durationHours = hours || 2;
    let endHour = hour + durationHours;
    let endMinute = minute || 0;
    // Clamp to 23:59 if past midnight
    if (endHour >= 24) endHour = 23, endMinute = 59;
    const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
    const startTime = `${String(hour).padStart(2, "0")}:${String(minute || 0).padStart(2, "0")}`;

    console.log("[CREATE-EVENT] Saving to DB:", { title, date, startTime, endTime, studioId });

    // Insert into studio_events
    const { data: event, error: insertError } = await supabase
      .from("studio_events")
      .insert({
        studio_id: studioId,
        title,
        description: description || null,
        client_name: clientName || null,
        client_email: clientEmail || null,
        service_type: serviceType || null,
        total_price: totalPrice || null,
        event_date: date,
        start_time: startTime,
        end_time: endTime,
        duration_hours: durationHours,
        color_id: colorId || "9",
        assigned_admin_id: assignedAdminId || user.id,
        created_by: user.id,
        status: "confirmed",
      })
      .select()
      .single();

    if (insertError) {
      console.error("[CREATE-EVENT] DB error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to create event", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("[CREATE-EVENT] Event saved:", event.id);

    // Also insert into session_assignments for admin color tracking
    try {
      await supabase.from("session_assignments").upsert({
        google_event_id: event.id,
        admin_user_id: assignedAdminId || user.id,
        assigned_at: new Date().toISOString(),
      }, { onConflict: "google_event_id" });
    } catch (e) {
      console.log("[CREATE-EVENT] Session assignment note:", e);
    }

    // Send notification email to studio admin with "Add to Google Calendar" link
    const googleCalLink = generateGoogleCalendarLink(title, date, startTime, endTime, description);
    
    // Try to get studio admin email
    try {
      const { data: studioData } = await supabase
        .from("studios").select("email, name, resend_api_key, resend_from_email").eq("id", studioId).single();
      
      const resendKey = studioData?.resend_api_key || Deno.env.get("RESEND_API_KEY");
      const fromEmail = studioData?.resend_from_email || "onboarding@resend.dev";
      const studioName = studioData?.name || "Studio";
      
      if (resendKey && studioData?.email) {
        console.log("[CREATE-EVENT] Sending notification email to:", studioData.email);
        
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #fff; padding: 30px; border-radius: 12px;">
            <h2 style="color: #06b6d4; margin-bottom: 20px;">📅 Nouvel événement créé</h2>
            <div style="background: #16213e; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #fff; margin: 0 0 10px 0;">${title}</h3>
              <p style="color: #94a3b8; margin: 5px 0;">📆 <strong style="color: #fff;">${date}</strong></p>
              <p style="color: #94a3b8; margin: 5px 0;">🕐 <strong style="color: #fff;">${startTime} → ${endTime}</strong> (${durationHours}h)</p>
              ${clientName ? `<p style="color: #94a3b8; margin: 5px 0;">👤 <strong style="color: #fff;">${clientName}</strong></p>` : ""}
              ${clientEmail ? `<p style="color: #94a3b8; margin: 5px 0;">📧 ${clientEmail}</p>` : ""}
              ${serviceType ? `<p style="color: #94a3b8; margin: 5px 0;">🎵 ${serviceType}</p>` : ""}
              ${totalPrice ? `<p style="color: #94a3b8; margin: 5px 0;">💰 ${totalPrice}€</p>` : ""}
              ${description ? `<p style="color: #94a3b8; margin: 10px 0; font-style: italic;">${description}</p>` : ""}
            </div>
            <div style="text-align: center; margin: 25px 0;">
              <a href="${googleCalLink}" 
                 style="display: inline-block; background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                📅 Ajouter à Google Calendar
              </a>
            </div>
            <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 20px;">
              ${studioName} — Événement créé le ${new Date().toLocaleDateString("fr-FR")}
            </p>
          </div>
        `;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: fromEmail,
            to: [studioData.email],
            subject: `📅 ${studioName} — Nouvel événement : ${title} (${date})`,
            html: emailHtml,
          }),
        });
        console.log("[CREATE-EVENT] Email sent to studio admin");
      }

      // Also send to client if email provided
      if (resendKey && clientEmail && clientEmail !== studioData?.email) {
        const clientHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #fff; padding: 30px; border-radius: 12px;">
            <h2 style="color: #06b6d4; margin-bottom: 20px;">📅 Votre session est confirmée !</h2>
            <div style="background: #16213e; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #fff; margin: 0 0 10px 0;">${title}</h3>
              <p style="color: #94a3b8; margin: 5px 0;">📆 <strong style="color: #fff;">${date}</strong></p>
              <p style="color: #94a3b8; margin: 5px 0;">🕐 <strong style="color: #fff;">${startTime} → ${endTime}</strong></p>
              <p style="color: #94a3b8; margin: 5px 0;">📍 <strong style="color: #fff;">${studioName}</strong></p>
            </div>
            <div style="text-align: center; margin: 25px 0;">
              <a href="${googleCalLink}" 
                 style="display: inline-block; background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                📅 Ajouter à mon Google Calendar
              </a>
            </div>
            <p style="color: #64748b; font-size: 12px; text-align: center;">
              Si vous devez modifier ou annuler, contactez-nous directement.
            </p>
          </div>
        `;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: fromEmail,
            to: [clientEmail],
            subject: `📅 Session confirmée — ${title} (${date})`,
            html: clientHtml,
          }),
        });
        console.log("[CREATE-EVENT] Email sent to client:", clientEmail);
      }
    } catch (emailErr) {
      console.error("[CREATE-EVENT] Email error (non-blocking):", emailErr);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        eventId: event.id,
        googleCalendarLink: googleCalLink,
        message: "Event created successfully in database" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[CREATE-EVENT] Error:", err);
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
