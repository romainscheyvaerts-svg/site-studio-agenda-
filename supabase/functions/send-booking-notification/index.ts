import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // 10 requests per minute per IP

function getClientIP(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
         req.headers.get("x-real-ip") || 
         "unknown";
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  record.count++;
  return true;
}

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
  driveFolderLink: z.string().optional(),
  isCashPayment: z.boolean().default(false),
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

// Generate Google Calendar link
const generateGoogleCalendarLink = (booking: any): string => {
  const startDateTime = new Date(`${booking.date}T${booking.time}:00`);
  const endDateTime = new Date(startDateTime.getTime() + (booking.duration || 2) * 60 * 60 * 1000);
  
  const formatDateForGoogle = (date: Date) => {
    return date.toISOString().replace(/-|:|\.\d\d\d/g, '');
  };
  
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Session Make Music - ${booking.clientName}`,
    dates: `${formatDateForGoogle(startDateTime)}/${formatDateForGoogle(endDateTime)}`,
    details: `Session: ${getSessionTypeLabel(booking.sessionType)}\nContact: ${booking.clientPhone || 'Non fourni'}`,
    location: 'Rue du Sceptre 22, 1050 Ixelles, Bruxelles',
  });
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting check
  const clientIP = getClientIP(req);
  if (!checkRateLimit(clientIP)) {
    console.log(`[RATE-LIMIT] IP ${clientIP} exceeded rate limit`);
    return new Response(
      JSON.stringify({ error: "Too many requests" }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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
    const googleCalendarLink = generateGoogleCalendarLink(booking);
    const isStudioSession = booking.sessionType === "with-engineer" || booking.sessionType === "without-engineer";
    
    // Payment status text
    const paymentStatusText = booking.isCashPayment 
      ? `<span style="color: #fbbf24;">Montant à payer le jour de la session: ${booking.totalPrice}€</span>`
      : booking.isDeposit 
        ? `Acompte payé: ${booking.totalPrice}€ (reste à payer au studio)`
        : `Paiement confirmé: ${booking.totalPrice}€`;

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
    
    // Drive folder section for client
    let driveFolderSection = "";
    if (booking.driveFolderLink) {
      driveFolderSection = `
        <div style="background: #262626; padding: 15px; border-radius: 8px; margin-top: 15px;">
          <h4 style="color: #fafafa; margin: 0 0 10px 0;">📁 Votre dossier Google Drive</h4>
          <p style="color: #a1a1aa; margin: 0 0 10px 0; font-size: 14px;">
            Vous pouvez déposer vos fichiers audio dans ce dossier partagé :
          </p>
          <a href="${escapeHtml(booking.driveFolderLink)}" style="display: inline-block; background: #22d3ee; color: #1a1a1a; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Ouvrir le dossier Drive
          </a>
        </div>
      `;
    }

    // ---------- 1. EMAIL TO ADMIN ----------
    const { error: adminEmailError } = await resend.emails.send({
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
            <h3 style="margin: 0 0 10px 0;">💰 ${booking.isCashPayment ? "À payer au studio" : booking.isDeposit ? "Acompte payé" : "Montant total"}</h3>
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

    if (adminEmailError) {
      console.error("[BOOKING-NOTIFICATION] Admin email error:", adminEmailError);
    } else {
      console.log("[BOOKING-NOTIFICATION] Admin email sent successfully");
    }

    // ---------- 2. EMAIL TO CLIENT ----------
    const { error: clientEmailError } = await resend.emails.send({
      from: "Make Music Studio <onboarding@resend.dev>",
      to: [booking.clientEmail],
      reply_to: "prod.makemusic@gmail.com",
      subject: `✅ Confirmation de réservation - Make Music Studio`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a1a; color: #fafafa;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #22d3ee; margin: 0;">Make Music Studio</h1>
            <p style="color: #a1a1aa; margin-top: 5px;">Bruxelles, Belgique</p>
          </div>
          
          <h2 style="color: #22d3ee; margin-bottom: 20px;">Merci pour votre réservation, ${escapeHtml(booking.clientName)} !</h2>
          
          <p style="color: #fafafa; margin-bottom: 20px;">
            Votre session a été confirmée. Voici les détails de votre réservation :
          </p>

          <div style="background: #262626; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
            <h3 style="color: #fafafa; margin-top: 0;">📅 Votre session</h3>
            <p><strong>Type :</strong> ${escapeHtml(sessionLabel)}</p>
            <p><strong>Date :</strong> ${escapeHtml(booking.date)}</p>
            <p><strong>Heure :</strong> ${escapeHtml(booking.time)}</p>
            ${booking.duration ? `<p><strong>Durée :</strong> ${booking.duration} heure(s)</p>` : ''}
          </div>

          <div style="background: ${booking.isCashPayment ? '#fbbf24' : '#22d3ee'}; color: #1a1a1a; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 15px;">
            <p style="font-size: 16px; margin: 0 0 5px 0; font-weight: bold;">
              ${booking.isCashPayment ? '💵 À payer au studio' : '💳 Paiement'}
            </p>
            <p style="font-size: 28px; font-weight: bold; margin: 0;">${booking.totalPrice}€</p>
            ${booking.isDeposit && !booking.isCashPayment ? '<p style="font-size: 12px; margin: 5px 0 0 0;">Acompte - Reste à payer au studio</p>' : ''}
          </div>

          ${driveFolderSection}

          <div style="background: #262626; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
            <h3 style="color: #fafafa; margin-top: 0;">📍 Adresse du studio</h3>
            <p style="color: #fafafa; margin: 0;">
              <strong>Rue du Sceptre 22</strong><br>
              1050 Ixelles, Bruxelles
            </p>
            <a href="https://maps.google.com/?q=Rue+du+Sceptre+22,+1050+Ixelles,+Bruxelles" 
               style="display: inline-block; margin-top: 10px; color: #22d3ee; text-decoration: underline;">
              Voir sur Google Maps
            </a>
          </div>

          ${isStudioSession ? `
          <div style="text-align: center; margin: 20px 0;">
            <a href="${googleCalendarLink}" 
               style="display: inline-block; background: #22d3ee; color: #1a1a1a; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
              📅 Ajouter à Google Calendar
            </a>
          </div>
          ` : ''}

          <div style="background: #262626; padding: 15px; border-radius: 8px; margin-top: 15px;">
            <h4 style="color: #fafafa; margin: 0 0 10px 0;">📞 Contact</h4>
            <p style="color: #a1a1aa; margin: 0; font-size: 14px;">
              Téléphone : <a href="tel:+32476094172" style="color: #22d3ee;">+32 476 09 41 72</a><br>
              Email : <a href="mailto:prod.makemusic@gmail.com" style="color: #22d3ee;">prod.makemusic@gmail.com</a>
            </p>
          </div>

          <p style="margin-top: 30px; color: #a1a1aa; font-size: 12px; text-align: center;">
            À très bientôt au studio ! 🎵<br>
            L'équipe Make Music
          </p>
        </div>
      `,
    });

    if (clientEmailError) {
      console.error("[BOOKING-NOTIFICATION] Client email error:", clientEmailError);
      throw clientEmailError;
    }
    
    console.log("[BOOKING-NOTIFICATION] Client email sent successfully to", booking.clientEmail);

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
