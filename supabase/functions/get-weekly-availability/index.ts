import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { startDate, days, studioId } = await req.json();

    if (!startDate || !days) {
      return new Response(
        JSON.stringify({ error: "Missing startDate or days" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[AVAILABILITY] Fetching from DB: ${startDate} for ${days} days, studio: ${studioId || "all"}`);

    // Calculate date range
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + days - 1);
    const endDateStr = end.toISOString().split("T")[0];

    // Fetch events from studio_events table
    let query = supabase
      .from("studio_events")
      .select("*")
      .gte("event_date", startDate)
      .lte("event_date", endDateStr)
      .eq("status", "confirmed")
      .order("event_date")
      .order("start_time");

    if (studioId) {
      query = query.eq("studio_id", studioId);
    }

    const { data: events, error: eventsError } = await query;

    if (eventsError) {
      console.error("[AVAILABILITY] DB error:", eventsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch events", details: eventsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Also fetch bookings
    let bookingsQuery = supabase
      .from("bookings")
      .select("*")
      .gte("session_date", startDate)
      .lte("session_date", endDateStr)
      .in("status", ["confirmed", "pending"]);

    if (studioId) {
      bookingsQuery = bookingsQuery.eq("studio_id", studioId);
    }

    const { data: bookings } = await bookingsQuery;

    console.log(`[AVAILABILITY] Found ${events?.length || 0} events + ${bookings?.length || 0} bookings`);

    // Build availability map
    const availability = [];
    const workingHours = { start: 0, end: 24 };

    for (let d = 0; d < days; d++) {
      const currentDate = new Date(start);
      currentDate.setDate(currentDate.getDate() + d);
      const dateStr = currentDate.toISOString().split("T")[0];

      // Get events for this day
      const dayEvents = (events || []).filter(e => e.event_date === dateStr);
      const dayBookings = (bookings || []).filter(b => b.session_date === dateStr);

      const slots = [];

      for (let hour = workingHours.start; hour < workingHours.end; hour++) {
        // Check if this hour is in the past
        const now = new Date();
        const slotTime = new Date(dateStr + "T" + String(hour).padStart(2, "0") + ":00:00");
        // Adjust for timezone (Europe/Brussels is UTC+1 or UTC+2)
        const isPast = slotTime.getTime() < (now.getTime() - 2 * 3600 * 1000);

        // Check events
        let matchedEvent = null;
        for (const event of dayEvents) {
          const eventStartHour = parseInt(event.start_time.split(":")[0]);
          const eventEndHour = parseInt(event.end_time.split(":")[0]);
          const eventEndMinute = parseInt(event.end_time.split(":")[1] || "0");
          const effectiveEndHour = eventEndMinute > 0 ? eventEndHour + 1 : eventEndHour;

          if (hour >= eventStartHour && hour < effectiveEndHour) {
            matchedEvent = event;
            break;
          }
        }

        // Check bookings
        let matchedBooking = null;
        if (!matchedEvent) {
          for (const booking of dayBookings) {
            const bookingStartHour = parseInt(booking.start_time.split(":")[0]);
            const bookingEndHour = parseInt(booking.end_time.split(":")[0]);
            if (hour >= bookingStartHour && hour < bookingEndHour) {
              matchedBooking = booking;
              break;
            }
          }
        }

        if (matchedEvent) {
          slots.push({
            hour,
            available: false,
            status: "unavailable",
            eventName: matchedEvent.title,
            eventId: matchedEvent.id,
            clientEmail: matchedEvent.client_email || undefined,
            clientName: matchedEvent.client_name || undefined,
            colorId: matchedEvent.color_id || undefined,
            serviceType: matchedEvent.service_type || undefined,
            totalPrice: matchedEvent.total_price || undefined,
          });
        } else if (matchedBooking) {
          slots.push({
            hour,
            available: false,
            status: "unavailable",
            eventName: `${matchedBooking.session_type || "Réservation"} - ${matchedBooking.client_name || "Client"}`,
            eventId: matchedBooking.id,
            clientEmail: matchedBooking.client_email || undefined,
            clientName: matchedBooking.client_name || undefined,
          });
        } else if (isPast) {
          slots.push({
            hour,
            available: false,
            status: "unavailable",
          });
        } else {
          slots.push({
            hour,
            available: true,
            status: "available",
            hasSecondaryCalendarConflict: false,
            hasTertiaryCalendarConflict: false,
          });
        }
      }

      availability.push({ date: dateStr, slots });
    }

    return new Response(
      JSON.stringify({ availability }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[AVAILABILITY] Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
