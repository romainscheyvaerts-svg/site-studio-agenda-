import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookingPayload {
  orderId: string;
  payerName: string;
  payerEmail: string;
  phone: string;
  sessionType: "with-engineer" | "without-engineer";
  date: string;
  time: string;
  hours: number;
  totalAmount: number;
  message?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: BookingPayload = await req.json();
    
    console.log("=== PAYMENT WEBHOOK RECEIVED ===");
    console.log("Order ID:", payload.orderId);
    console.log("Client:", payload.payerName);
    console.log("Email:", payload.payerEmail);
    console.log("Phone:", payload.phone);
    console.log("Session Type:", payload.sessionType);
    console.log("Date:", payload.date);
    console.log("Time:", payload.time);
    console.log("Duration:", payload.hours, "hours");
    console.log("Total Amount:", payload.totalAmount, "€");
    console.log("Message:", payload.message || "N/A");

    const sessionLabel = payload.sessionType === "with-engineer" 
      ? "AVEC INGÉNIEUR" 
      : "LOCATION SÈCHE";

    // TODO: ACTION 1 - Google Calendar Integration
    // Add appointment with title format: "SESSION [TYPE] - [CLIENT]"
    console.log(`[CALENDAR] Would create event: SESSION ${sessionLabel} - ${payload.payerName}`);
    console.log(`[CALENDAR] Date: ${payload.date} at ${payload.time} for ${payload.hours}h`);

    // TODO: ACTION 2 - Google Drive Integration  
    // Create shared folder for client
    console.log(`[DRIVE] Would create folder for: ${payload.payerName}`);

    // TODO: ACTION 3 - Email with Resend
    // Send confirmation with summary, Drive link, and phone number
    // Engineer's phone for accompanied sessions, manager's phone for solo sessions
    const contactPhone = payload.sessionType === "with-engineer" 
      ? "Numéro ingénieur" 
      : "Numéro gérant";
    console.log(`[EMAIL] Would send confirmation to: ${payload.payerEmail}`);
    console.log(`[EMAIL] Contact phone included: ${contactPhone}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook processed successfully",
        booking: {
          orderId: payload.orderId,
          client: payload.payerName,
          sessionType: sessionLabel,
          date: payload.date,
          time: payload.time,
          hours: payload.hours,
          total: payload.totalAmount,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in paypal-webhook:", errorMessage);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
