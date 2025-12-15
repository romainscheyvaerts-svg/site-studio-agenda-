import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const BookingNotificationSchema = z.object({
  clientName: z.string().min(1),
  clientEmail: z.string().email(),
  clientPhone: z.string().optional(),
  sessionType: z.string(),
  date: z.string(),
  time: z.string(),
  duration: z.number().optional(),
  totalPrice: z.number(),
  isDeposit: z.boolean().default(false),
  identityDocUrl: z.string().optional(),
  isAdmin: z.boolean().default(false),
});

const escapeHtml = (str: string) => str
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const getSessionTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    "with-engineer": "Session avec ingénieur (45€/h)",
    "without-engineer": "Location sans ingénieur (22€/h)",
    "mixing": "Mixage (200€)",
    "mastering": "Mastering (60€)",
    "analog-mastering": "Mastering Analogique (100€/piste)",
    "podcast": "Mixage Podcast",
  };
  return labels[type] || type;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    const validationResult = BookingNotificationSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      console.error("[BOOKING-NOTIFICATION] Validation error:", validationResult.error.errors);
      return new Response(
        JSON.stringify({ error: "Invalid request data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const booking = validationResult.data;
    console.log("[BOOKING-NOTIFICATION] Sending notification for:", booking.clientName);

    const sessionLabel = getSessionTypeLabel(booking.sessionType);
    const bookedBy = booking.isAdmin ? "ADMIN" : "CLIENT";
    
    let identitySection = "";
    if (booking.identityDocUrl && !booking.isAdmin) {
      identitySection = `
        <div style="background: #262626; padding: 15px; border-radius: 8px; margin-top: 15px;">
          <h4 style="color: #fafafa; margin: 0 0 10px 0;">📋 Pièce d'identité</h4>
          <a href="${escapeHtml(booking.identityDocUrl)}" style="color: #22d3ee; text-decoration: underline;">
            Voir le document
          </a>
        </div>
      `;
    }

    const { error: emailError } = await resend.emails.send({
      from: "Make Music Studio <onboarding@resend.dev>",
      to: ["romain.scheyvaerts@gmail.com"],
      reply_to: "prod.makemusic@gmail.com",
      subject: `🎵 Nouvelle réservation [${bookedBy}] - ${escapeHtml(booking.clientName)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a1a; color: #fafafa;">
          <h2 style="color: #22d3ee; margin-bottom: 20px;">Nouvelle réservation ${bookedBy === "ADMIN" ? "(Admin)" : ""}</h2>
          
          <div style="background: #262626; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
            <h3 style="color: #fafafa; margin-top: 0;">👤 Informations client</h3>
            <p><strong>Nom :</strong> ${escapeHtml(booking.clientName)}</p>
            <p><strong>Email :</strong> <a href="mailto:${escapeHtml(booking.clientEmail)}" style="color: #22d3ee;">${escapeHtml(booking.clientEmail)}</a></p>
            ${booking.clientPhone ? `<p><strong>Téléphone :</strong> ${escapeHtml(booking.clientPhone)}</p>` : ''}
          </div>

          <div style="background: #262626; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
            <h3 style="color: #fafafa; margin-top: 0;">📅 Détails de la session</h3>
            <p><strong>Type :</strong> ${escapeHtml(sessionLabel)}</p>
            <p><strong>Date :</strong> ${escapeHtml(booking.date)}</p>
            <p><strong>Heure :</strong> ${escapeHtml(booking.time)}</p>
            ${booking.duration ? `<p><strong>Durée :</strong> ${booking.duration} heure(s)</p>` : ''}
          </div>

          <div style="background: #22d3ee; color: #1a1a1a; padding: 20px; border-radius: 8px; text-align: center;">
            <h3 style="margin: 0 0 10px 0;">💰 ${booking.isDeposit ? "Acompte payé" : "Montant total"}</h3>
            <p style="font-size: 28px; font-weight: bold; margin: 0;">${booking.totalPrice}€</p>
          </div>

          ${identitySection}

          <p style="margin-top: 20px; color: #a1a1aa; font-size: 12px; text-align: center;">
            Réservation reçue le ${new Date().toLocaleDateString('fr-BE', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      `,
    });

    if (emailError) {
      console.error("[BOOKING-NOTIFICATION] Email error:", emailError);
      throw emailError;
    }

    console.log("[BOOKING-NOTIFICATION] Email sent successfully");

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[BOOKING-NOTIFICATION] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
