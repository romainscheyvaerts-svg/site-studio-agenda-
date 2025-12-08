import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const generateConfirmationEmail = (payload: BookingPayload): string => {
  const sessionLabel = payload.sessionType === "with-engineer" 
    ? "Session avec ingénieur son" 
    : "Location sèche (autonomie)";
  
  const contactInfo = payload.sessionType === "with-engineer"
    ? `<p style="margin: 0 0 10px 0;"><strong>Contact ingénieur :</strong> Un ingénieur vous contactera avant votre session.</p>`
    : `<p style="margin: 0 0 10px 0;"><strong>Contact studio :</strong> Vous recevrez les instructions d'accès par email.</p>`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0b;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #111113; border-radius: 16px; border: 1px solid #1e1e21;">
              
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 30px 40px; text-align: center; border-bottom: 1px solid #1e1e21;">
                  <h1 style="margin: 0; color: #22d3ee; font-size: 28px; font-weight: bold; letter-spacing: 2px;">
                    MAKE MUSIC STUDIO
                  </h1>
                  <p style="margin: 10px 0 0 0; color: #71717a; font-size: 14px;">
                    Confirmation de réservation
                  </p>
                </td>
              </tr>

              <!-- Success Message -->
              <tr>
                <td style="padding: 30px 40px;">
                  <div style="background: linear-gradient(135deg, rgba(34, 211, 238, 0.1), rgba(251, 191, 36, 0.1)); border-radius: 12px; padding: 24px; text-align: center; border: 1px solid rgba(34, 211, 238, 0.2);">
                    <div style="width: 60px; height: 60px; background-color: rgba(34, 197, 94, 0.2); border-radius: 50%; margin: 0 auto 16px auto; display: flex; align-items: center; justify-content: center;">
                      <span style="color: #22c55e; font-size: 30px;">✓</span>
                    </div>
                    <h2 style="margin: 0 0 8px 0; color: #fafafa; font-size: 22px;">Paiement confirmé !</h2>
                    <p style="margin: 0; color: #a1a1aa; font-size: 14px;">Votre session est réservée, ${payload.payerName}</p>
                  </div>
                </td>
              </tr>

              <!-- Booking Details -->
              <tr>
                <td style="padding: 0 40px 30px 40px;">
                  <h3 style="margin: 0 0 20px 0; color: #fafafa; font-size: 18px; border-bottom: 1px solid #1e1e21; padding-bottom: 10px;">
                    Détails de votre réservation
                  </h3>
                  
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding: 12px 0; border-bottom: 1px solid #1e1e21;">
                        <span style="color: #71717a; font-size: 14px;">Type de session</span><br>
                        <span style="color: #22d3ee; font-size: 16px; font-weight: 600;">${sessionLabel}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0; border-bottom: 1px solid #1e1e21;">
                        <span style="color: #71717a; font-size: 14px;">Date</span><br>
                        <span style="color: #fafafa; font-size: 16px; font-weight: 600;">${formatDate(payload.date)}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0; border-bottom: 1px solid #1e1e21;">
                        <span style="color: #71717a; font-size: 14px;">Heure</span><br>
                        <span style="color: #fafafa; font-size: 16px; font-weight: 600;">${payload.time}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0; border-bottom: 1px solid #1e1e21;">
                        <span style="color: #71717a; font-size: 14px;">Durée</span><br>
                        <span style="color: #fafafa; font-size: 16px; font-weight: 600;">${payload.hours} heure${payload.hours > 1 ? 's' : ''}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0;">
                        <span style="color: #71717a; font-size: 14px;">Montant payé</span><br>
                        <span style="color: #fbbf24; font-size: 20px; font-weight: bold;">${payload.totalAmount}€</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Contact Info -->
              <tr>
                <td style="padding: 0 40px 30px 40px;">
                  <div style="background-color: #18181b; border-radius: 12px; padding: 20px; border: 1px solid #27272a;">
                    <h4 style="margin: 0 0 12px 0; color: #fafafa; font-size: 16px;">Informations importantes</h4>
                    ${contactInfo}
                    <p style="margin: 0 0 10px 0; color: #a1a1aa; font-size: 14px;">
                      <strong style="color: #fafafa;">Référence :</strong> ${payload.orderId}
                    </p>
                    ${payload.message ? `<p style="margin: 0; color: #a1a1aa; font-size: 14px;"><strong style="color: #fafafa;">Votre message :</strong> ${payload.message}</p>` : ''}
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; background-color: #09090b; border-radius: 0 0 16px 16px; text-align: center; border-top: 1px solid #1e1e21;">
                  <p style="margin: 0 0 10px 0; color: #71717a; font-size: 14px;">
                    À très bientôt au studio !
                  </p>
                  <p style="margin: 0; color: #52525b; font-size: 12px;">
                    Make Music Studio • Email: prod.makemusic@gmail.com
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

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

    // ACTION 1: Send confirmation email to client
    console.log("[EMAIL] Sending confirmation email to:", payload.payerEmail);
    
    try {
      const emailHtml = generateConfirmationEmail(payload);
      
      const emailResponse = await resend.emails.send({
        from: "Make Music Studio <onboarding@resend.dev>",
        to: [payload.payerEmail],
        subject: `✅ Réservation confirmée - ${formatDate(payload.date)} à ${payload.time}`,
        html: emailHtml,
      });

      console.log("[EMAIL] Confirmation email sent successfully:", emailResponse);
    } catch (emailError) {
      console.error("[EMAIL] Failed to send confirmation email:", emailError);
      // Don't fail the whole webhook if email fails
    }

    // TODO: ACTION 2 - Google Calendar Integration
    // Add appointment with title format: "SESSION [TYPE] - [CLIENT]"
    console.log(`[CALENDAR] Would create event: SESSION ${sessionLabel} - ${payload.payerName}`);
    console.log(`[CALENDAR] Date: ${payload.date} at ${payload.time} for ${payload.hours}h`);

    // TODO: ACTION 3 - Google Drive Integration  
    // Create shared folder for client
    console.log(`[DRIVE] Would create folder for: ${payload.payerName}`);

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
