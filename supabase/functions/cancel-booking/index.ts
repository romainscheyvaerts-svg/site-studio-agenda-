import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { google } from "https://esm.sh/googleapis@126";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { bookingId, reason } = await req.json();

    if (!bookingId) {
      return new Response(JSON.stringify({ error: "bookingId is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Get booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // Verify user owns this booking
    if (booking.client_email !== user.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Check if session is in the future
    const sessionDate = new Date(`${booking.session_date}T${booking.start_time}`);
    if (sessionDate < new Date()) {
      return new Response(JSON.stringify({ error: "Cannot cancel past sessions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Update booking status to cancelled
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.email,
        cancellation_reason: reason || "Client cancellation",
      })
      .eq("id", bookingId);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to cancel booking" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Create admin notification
    await supabase.from("admin_notifications").insert({
      type: "booking_cancelled",
      title: "🚫 Réservation annulée",
      message: `${booking.client_name} a annulé sa session du ${booking.session_date} à ${booking.start_time}. Raison: ${reason || "Non spécifiée"}`,
      client_email: booking.client_email,
      client_name: booking.client_name,
      metadata: {
        booking_id: bookingId,
        session_date: booking.session_date,
        session_type: booking.session_type,
        amount_paid: booking.amount_paid,
        reason: reason,
      },
    });

    // Try to delete Google Calendar event
    if (booking.google_calendar_event_id) {
      try {
        const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
        if (serviceAccountKey) {
          const credentials = JSON.parse(serviceAccountKey);
          const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ["https://www.googleapis.com/auth/calendar"],
          });
          const calendar = google.calendar({ version: "v3", auth });
          const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID") || "primary";

          await calendar.events.delete({
            calendarId,
            eventId: booking.google_calendar_event_id,
          });
          console.log("Calendar event deleted");
        }
      } catch (calError) {
        console.error("Failed to delete calendar event:", calError);
        // Continue anyway, notification is more important
      }
    }

    // Send email notification to admin
    try {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "prod.makemusic@gmail.com";

      if (RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Make Music Studio <noreply@makemusicstudio.be>",
            to: ADMIN_EMAIL,
            subject: `🚫 Annulation - ${booking.client_name} - ${booking.session_date}`,
            html: `
              <h2>Une réservation a été annulée</h2>
              <p><strong>Client:</strong> ${booking.client_name} (${booking.client_email})</p>
              <p><strong>Téléphone:</strong> ${booking.client_phone || "Non renseigné"}</p>
              <p><strong>Date:</strong> ${booking.session_date}</p>
              <p><strong>Heure:</strong> ${booking.start_time} - ${booking.end_time}</p>
              <p><strong>Type:</strong> ${booking.session_type}</p>
              <p><strong>Montant payé:</strong> ${booking.amount_paid}€</p>
              <p><strong>Raison:</strong> ${reason || "Non spécifiée"}</p>
              <hr>
              <p style="color: #888;">Pensez à traiter le remboursement si nécessaire.</p>
            `,
          }),
        });
        console.log("Admin email sent");
      }
    } catch (emailError) {
      console.error("Email error:", emailError);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Booking cancelled" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
