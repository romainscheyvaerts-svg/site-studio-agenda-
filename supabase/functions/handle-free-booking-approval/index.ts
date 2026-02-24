import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const getSessionTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    'with-engineer': 'Session avec ingénieur',
    'without-engineer': 'Location sèche',
    'mixing': 'Mixage',
    'mastering': 'Mastering',
    'analog-mastering': 'Mastering analogique',
    'podcast': 'Podcast',
    'composition': 'Composition'
  };
  return labels[type] || type;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, action } = await req.json();

    if (!token || !action) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing token or action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the pending booking by token
    const { data: booking, error: fetchError } = await supabase
      .from('pending_free_bookings')
      .select('*')
      .eq('approval_token', token)
      .eq('status', 'pending')
      .single();

    if (fetchError || !booking) {
      console.error("[APPROVAL] Booking not found:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Booking not found or already processed" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if expired
    if (new Date(booking.expires_at) < new Date()) {
      await supabase
        .from('pending_free_bookings')
        .update({ status: 'expired' })
        .eq('id', booking.id);

      return new Response(
        JSON.stringify({ success: false, error: "Booking request has expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Update the booking status
    const { error: updateError } = await supabase
      .from('pending_free_bookings')
      .update({ 
        status: newStatus, 
        responded_at: new Date().toISOString() 
      })
      .eq('id', booking.id);

    if (updateError) {
      console.error("[APPROVAL] Update error:", updateError);
      throw updateError;
    }

    // Email configuration
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@studiomakemusic.com";
    const fromAddress = fromEmail.includes("<") ? fromEmail : `Make Music Studio <${fromEmail}>`;
    const adminEmail = "prod.makemusic@gmail.com";

    if (action === 'approve') {
      // Send confirmation email to client
      await resend.emails.send({
        from: fromAddress,
        reply_to: adminEmail,
        to: [booking.client_email],
        subject: `✅ Votre session gratuite est confirmée - ${formatDate(booking.session_date)}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"></head>
          <body style="margin: 0; padding: 0; background-color: #0a0a0b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0b;">
              <tr>
                <td align="center" style="padding: 40px 20px;">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #111113; border-radius: 16px; border: 1px solid #1e1e21;">
                    <tr>
                      <td style="padding: 40px; text-align: center; border-bottom: 1px solid #1e1e21;">
                        <h1 style="margin: 0; color: #fafafa; font-size: 28px;">MAKE MUSIC STUDIO</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 30px 40px;">
                        <div style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 211, 238, 0.1)); border-radius: 12px; padding: 24px; text-align: center; border: 1px solid rgba(34, 197, 94, 0.3);">
                          <div style="width: 60px; height: 60px; background-color: rgba(34, 197, 94, 0.2); border-radius: 50%; margin: 0 auto 16px auto; display: flex; align-items: center; justify-content: center;">
                            <span style="color: #22c55e; font-size: 30px;">✓</span>
                          </div>
                          <h2 style="margin: 0 0 8px 0; color: #22c55e; font-size: 22px;">Session Confirmée !</h2>
                          <p style="margin: 0; color: #a1a1aa; font-size: 14px;">Votre session gratuite a été confirmée par l'admin</p>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 0 40px 30px;">
                        <h3 style="margin: 0 0 20px 0; color: #fafafa; border-bottom: 1px solid #1e1e21; padding-bottom: 10px;">Détails de votre session</h3>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding: 12px 0; border-bottom: 1px solid #1e1e21;">
                              <span style="color: #71717a; font-size: 14px;">Service</span><br>
                              <span style="color: #22d3ee; font-size: 16px; font-weight: 600;">${getSessionTypeLabel(booking.session_type)}</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 0; border-bottom: 1px solid #1e1e21;">
                              <span style="color: #71717a; font-size: 14px;">Date</span><br>
                              <span style="color: #fafafa; font-size: 16px; font-weight: 600;">${formatDate(booking.session_date)}</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 0; border-bottom: 1px solid #1e1e21;">
                              <span style="color: #71717a; font-size: 14px;">Heure</span><br>
                              <span style="color: #fafafa; font-size: 16px; font-weight: 600;">${booking.session_time}</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 0;">
                              <span style="color: #71717a; font-size: 14px;">Durée</span><br>
                              <span style="color: #fafafa; font-size: 16px; font-weight: 600;">${booking.duration_hours} heure${booking.duration_hours > 1 ? 's' : ''}</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 30px 40px; background-color: #09090b; border-radius: 0 0 16px 16px; text-align: center;">
                        <p style="margin: 0 0 8px 0; color: #a1a1aa; font-size: 14px;">📍 Rue du Sceptre 22, 1050 Ixelles, Bruxelles</p>
                        <p style="margin: 0; color: #52525b; font-size: 12px;">Make Music Studio • +32 476 09 41 72</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      });

      console.log(`[APPROVAL] Session APPROVED for ${booking.client_name}`);

      // TODO: Create Google Calendar event (reuse logic from paypal-webhook)

    } else {
      // Send rejection email to client
      await resend.emails.send({
        from: fromAddress,
        reply_to: adminEmail,
        to: [booking.client_email],
        subject: `Session non confirmée - Make Music Studio`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"></head>
          <body style="margin: 0; padding: 0; background-color: #0a0a0b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0b;">
              <tr>
                <td align="center" style="padding: 40px 20px;">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #111113; border-radius: 16px; border: 1px solid #1e1e21;">
                    <tr>
                      <td style="padding: 40px; text-align: center; border-bottom: 1px solid #1e1e21;">
                        <h1 style="margin: 0; color: #fafafa; font-size: 28px;">MAKE MUSIC STUDIO</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 30px 40px;">
                        <div style="background: rgba(239, 68, 68, 0.1); border-radius: 12px; padding: 24px; text-align: center; border: 1px solid rgba(239, 68, 68, 0.3);">
                          <h2 style="margin: 0 0 8px 0; color: #ef4444; font-size: 22px;">Session Non Confirmée</h2>
                          <p style="margin: 0; color: #a1a1aa; font-size: 14px;">
                            Nous sommes désolés, mais votre demande de session gratuite pour le ${formatDate(booking.session_date)} n'a pas pu être confirmée.
                          </p>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 0 40px 30px;">
                        <p style="color: #a1a1aa; font-size: 14px; text-align: center;">
                          Vous pouvez nous contacter directement pour discuter d'une autre date ou d'autres options.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 30px 40px; background-color: #09090b; border-radius: 0 0 16px 16px; text-align: center;">
                        <p style="margin: 0 0 8px 0; color: #a1a1aa; font-size: 14px;">📞 +32 476 09 41 72</p>
                        <p style="margin: 0; color: #52525b; font-size: 12px;">prod.makemusic@gmail.com</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      });

      console.log(`[APPROVAL] Session REJECTED for ${booking.client_name}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        status: newStatus,
        message: action === 'approve' 
          ? 'Session confirmée et email envoyé au client' 
          : 'Session refusée et email envoyé au client'
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[HANDLE-FREE-BOOKING-APPROVAL] Error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
