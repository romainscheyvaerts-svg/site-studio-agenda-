import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Input validation schema
const availabilitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  duration: z.number().int().min(1).max(12),
  sessionType: z.enum(["with-engineer", "without-engineer", "mixing", "mastering", "analog-mastering", "podcast"]),
  studioId: z.string().uuid().optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();

    // Validate input
    const parseResult = availabilitySchema.safeParse(rawBody);
    if (!parseResult.success) {
      console.error("[CHECK-AVAILABILITY] Invalid input:", parseResult.error.errors);
      return new Response(
        JSON.stringify({
          error: "Invalid input",
          details: parseResult.error.errors.map((e) => e.message),
          available: false,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { date, time, duration, sessionType, studioId } = parseResult.data;

    console.log(`[CHECK-AVAILABILITY] Checking: ${date} at ${time}, duration: ${duration}h, type: ${sessionType}, studio: ${studioId}`);

    // Parse requested start and end times
    const [hour, minute] = time.split(":").map(Number);
    const endHour = hour + duration;
    const endMinute = minute;
    const startTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const endTime = `${String(Math.min(endHour, 23)).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;

    // For mixing/mastering - always available (async work)
    if (sessionType === "mixing" || sessionType === "mastering" || sessionType === "analog-mastering") {
      return new Response(
        JSON.stringify({
          available: true,
          message: "Votre demande de mixage/mastering peut être traitée.",
          status: "available",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check studio_events table for conflicts
    let query = supabase
      .from("studio_events")
      .select("id, title, event_date, start_time, end_time, status")
      .eq("event_date", date)
      .in("status", ["confirmed", "pending"]);

    if (studioId) {
      query = query.eq("studio_id", studioId);
    }

    const { data: events, error: dbError } = await query;

    if (dbError) {
      console.error("[CHECK-AVAILABILITY] DB error:", dbError);
      throw new Error("Database error: " + dbError.message);
    }

    console.log(`[CHECK-AVAILABILITY] Found ${events?.length || 0} events on ${date}`);

    // Check for time overlaps
    let hasConflict = false;

    if (events && events.length > 0) {
      for (const event of events) {
        const eventStart = event.start_time; // "HH:MM" or "HH:MM:SS"
        const eventEnd = event.end_time;     // "HH:MM" or "HH:MM:SS"

        if (!eventStart || !eventEnd) continue;

        // Parse times to minutes for easy comparison
        const toMinutes = (t: string) => {
          const parts = t.split(":").map(Number);
          return parts[0] * 60 + (parts[1] || 0);
        };

        const reqStartMin = toMinutes(startTime);
        const reqEndMin = toMinutes(endTime);
        const evtStartMin = toMinutes(eventStart);
        const evtEndMin = toMinutes(eventEnd);

        // Check overlap: events overlap if one starts before the other ends
        if (reqStartMin < evtEndMin && reqEndMin > evtStartMin) {
          console.log(`[CHECK-AVAILABILITY] Conflict with event "${event.title}" (${eventStart}-${eventEnd})`);
          hasConflict = true;
          break;
        }
      }
    }

    let isAvailable: boolean;
    let message: string;
    let status: "available" | "unavailable" | "on-request";

    if (hasConflict) {
      isAvailable = false;
      status = "unavailable";
      message = "Désolé, ce créneau n'est pas disponible.";
    } else {
      isAvailable = true;
      status = "available";
      message = "Ce créneau est disponible.";
    }

    console.log(`[CHECK-AVAILABILITY] Result: ${status} - ${message}`);

    return new Response(
      JSON.stringify({ available: isAvailable, message, status }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[CHECK-AVAILABILITY] Error:", errorMessage);

    return new Response(
      JSON.stringify({ error: errorMessage, available: false }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
