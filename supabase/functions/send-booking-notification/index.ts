import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // 10 requests per minute per IP

function getClientIP(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
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
  validationToken: z.string().optional(), // For confirmation flow
  bookingId: z.string().optional(), // For confirmation flow
});

const escapeHtml = (str: string) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const getSessionTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    "with-engineer": "Session avec ingénieur (45€/h)",
    "without-engineer": "Location sans ingénieur (22€/h)",
    mixing: "Mixage (200€)",
    mastering: "Mastering (60€)",
    "analog-mastering": "Mastering Analogique (100€/piste)",
    podcast: "Mixage Podcast",
    "admin-event": "Réservation (créée par admin)",
  };
  return labels[type] || type;
};

// Generate Google Calendar link (client-side link, not the studio agenda)
const generateGoogleCalendarLink = (booking: any): string => {
  const startDateTime = new Date(`${booking.date}T${booking.time}:00`);
  const endDateTime = new Date(
    startDateTime.getTime() + (booking.duration || 2) * 60 * 60 * 1000
  );

  const formatDateForGoogle = (date: Date) => {
    return date.toISOString().replace(/-|:|\.\d\d\d/g, "");
  };

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Session Make Music - ${booking.clientName}`,
    dates: `${formatDateForGoogle(startDateTime)}/${formatDateForGoogle(endDateTime)}`,
    details: `Session: ${getSessionTypeLabel(booking.sessionType)}\nContact: ${booking.clientPhone || "Non fourni"}`,
    location: "Rue du Sceptre 22, 1050 Ixelles, Bruxelles",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[BOOKING-NOTIFICATION] ${step}${detailsStr}`);
};

const PARENT_FOLDER_ID = "1AXGpSHUP0OyY2tWvCk573xb--Dj2jvLh";

async function getGoogleAccessToken(serviceAccountKey: string, scope: string): Promise<string> {
  const key = JSON.parse(serviceAccountKey);
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: key.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const signatureInput = `${headerB64}.${payloadB64}`;

  const keyData = key.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(signatureInput)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${headerB64}.${payloadB64}.${signatureB64}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) {
    throw new Error(`Google token error: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

async function createClientDriveFolder(
  supabaseClient: any,
  accessToken: string,
  booking: any
): Promise<{ clientFolderLink: string; subfolderLink: string } | null> {
  try {
    const clientEmailRaw = booking.clientEmail;
    const clientEmail = (clientEmailRaw || "").toLowerCase().trim();
    const clientName = booking.clientName;
    const sessionDate = booking.date;

    const { data: existingFolder } = await supabaseClient
      .from("client_drive_folders")
      .select("*")
      .eq("client_email", clientEmail)
      .maybeSingle();

    let clientFolderId: string;
    let clientFolderLink: string;

    if (existingFolder) {
      // Verify folder name matches email. If legacy folder exists (named by client name), migrate to email folder.
      let shouldMigrateToEmailFolder = false;
      try {
        const metaRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${existingFolder.drive_folder_id}?fields=name`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const meta = await metaRes.json();
        const folderName = (meta?.name || "").toLowerCase().trim();
        if (metaRes.ok && folderName && folderName !== clientEmail) {
          shouldMigrateToEmailFolder = true;
          logStep("Legacy client folder detected (will migrate)", {
            folderName: meta?.name,
            clientEmail,
          });
        }
      } catch (e) {
        logStep("Could not verify Drive folder name", { error: e instanceof Error ? e.message : String(e) });
      }

      if (!shouldMigrateToEmailFolder) {
        logStep("Using existing client folder", { folderId: existingFolder.drive_folder_id });
        clientFolderId = existingFolder.drive_folder_id;
        clientFolderLink = existingFolder.drive_folder_link;
      } else {
        logStep("Creating new email-named folder for", { clientEmail });

        const createFolderResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: clientEmail,
            mimeType: "application/vnd.google-apps.folder",
            parents: [PARENT_FOLDER_ID],
          }),
        });

        const newFolder = await createFolderResponse.json();
        if (!createFolderResponse.ok) {
          logStep("Failed to create migrated client folder", { error: newFolder });
          return null;
        }

        clientFolderId = newFolder.id;
        clientFolderLink = `https://drive.google.com/drive/folders/${newFolder.id}`;

        await fetch(`https://www.googleapis.com/drive/v3/files/${newFolder.id}/permissions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: "writer", type: "anyone" }),
        });

        await supabaseClient
          .from("client_drive_folders")
          .update({
            client_email: clientEmail,
            client_name: clientName || clientEmail,
            drive_folder_id: newFolder.id,
            drive_folder_link: clientFolderLink,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingFolder.id);

        logStep("Client folder migrated", { clientFolderLink });
      }
    } else {
      logStep("Creating new client folder", { clientName, clientEmail });

      const createFolderResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: clientEmail, // Use email as folder name to avoid duplicates (case sensitivity)
          mimeType: "application/vnd.google-apps.folder",
          parents: [PARENT_FOLDER_ID],
        }),
      });

      const newFolder = await createFolderResponse.json();
      if (!createFolderResponse.ok) {
        logStep("Failed to create client folder", { error: newFolder });
        return null;
      }

      clientFolderId = newFolder.id;
      clientFolderLink = `https://drive.google.com/drive/folders/${newFolder.id}`;

      await fetch(`https://www.googleapis.com/drive/v3/files/${newFolder.id}/permissions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "writer", type: "anyone" }),
      });

      await supabaseClient.from("client_drive_folders").insert({
        client_email: clientEmail,
        client_name: clientName || clientEmail,
        drive_folder_id: newFolder.id,
        drive_folder_link: clientFolderLink,
      });

      logStep("Client folder created", { clientFolderLink });
    }

    const subfolderName = sessionDate || new Date().toISOString().split("T")[0];

    const createSubfolderResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: subfolderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [clientFolderId],
      }),
    });

    const subfolder = await createSubfolderResponse.json();
    if (!createSubfolderResponse.ok) {
      logStep("Failed to create subfolder", { error: subfolder });
      return null;
    }

    await fetch(`https://www.googleapis.com/drive/v3/files/${subfolder.id}/permissions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "writer", type: "anyone" }),
    });

    const subfolderLink = `https://drive.google.com/drive/folders/${subfolder.id}`;
    logStep("Session subfolder created", { subfolderLink });

    return { clientFolderLink, subfolderLink };
  } catch (error) {
    logStep("Error creating Drive folder", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function addToStudioGoogleCalendar(
  accessToken: string,
  calendarId: string,
  booking: any
): Promise<string | null> {
  // Format time correctly - if already has seconds, don't add more
  const formatTime = (time: string) => {
    if (!time) return "00:00:00";
    if (/^\d{2}:\d{2}$/.test(time)) return `${time}:00`;
    if (/^\d{2}:\d{2}:\d{2}$/.test(time)) return time;
    return `${time}:00`;
  };
  
  const startDateTime = `${booking.date}T${formatTime(booking.time)}`;
  const durationHours = booking.duration || 2;
  const endDate = new Date(`${booking.date}T${formatTime(booking.time)}`);
  endDate.setHours(endDate.getHours() + durationHours);
  const endDateTime = endDate.toISOString().slice(0, 19);

  const event = {
    summary: `${booking.clientName} — ${getSessionTypeLabel(booking.sessionType)}`,
    description: `Client: ${booking.clientName}\nEmail: ${booking.clientEmail}\nTéléphone: ${booking.clientPhone || "Non fourni"}\nMontant: ${booking.totalPrice}€`,
    start: { dateTime: startDateTime, timeZone: "Europe/Brussels" },
    end: { dateTime: endDateTime, timeZone: "Europe/Brussels" },
  };

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    logStep("Failed to add to studio Google Calendar", { error: errorText });
    return null;
  }

  const createdEvent = await response.json();
  logStep("Event added to studio Google Calendar", { eventId: createdEvent.id });
  return createdEvent.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting check
  const clientIP = getClientIP(req);
  if (!checkRateLimit(clientIP)) {
    console.log(`[RATE-LIMIT] IP ${clientIP} exceeded rate limit`);
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const rawBody = await req.json();
    const validationResult = BookingNotificationSchema.safeParse(rawBody);

    if (!validationResult.success) {
      console.error("[BOOKING-NOTIFICATION] Validation error:", validationResult.error.errors);
      return new Response(JSON.stringify({ error: "Invalid request data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const booking = validationResult.data;
    logStep("Sending notification", { clientName: booking.clientName, sessionType: booking.sessionType });

    const sessionLabel = getSessionTypeLabel(booking.sessionType);
    const bookedBy = booking.isAdmin ? "ADMIN" : "CLIENT";
    const googleCalendarLink = generateGoogleCalendarLink(booking);
    const isStudioSession = booking.sessionType === "with-engineer" || booking.sessionType === "without-engineer";

    // Check if booking is less than 24 hours in advance (only for non-admin studio sessions)
    const sessionDateTime = new Date(`${booking.date}T${booking.time}:00`);
    const now = new Date();
    const hoursUntilSession = (sessionDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const isLessThan24Hours = hoursUntilSession < 24 && hoursUntilSession > 0;
    const requiresConfirmation = isLessThan24Hours && isStudioSession && !booking.isAdmin;
    
    logStep("Checking 24h rule", { 
      hoursUntilSession: Math.round(hoursUntilSession * 10) / 10, 
      isLessThan24Hours, 
      requiresConfirmation,
      isAdmin: booking.isAdmin
    });

    // Ensure we create Drive folder link for studio sessions (if not already provided)
    // BUT only if not requiring confirmation (will be created on confirm)
    let driveFolderLink = booking.driveFolderLink;

    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    const studioCalendarId = Deno.env.get("GOOGLE_STUDIO_CALENDAR_ID");

    // Only create Drive folder and add to calendar if NOT requiring confirmation
    if (!requiresConfirmation) {
      if (!driveFolderLink && isStudioSession && serviceAccountKey) {
        try {
          const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            { auth: { persistSession: false } }
          );

          const driveToken = await getGoogleAccessToken(serviceAccountKey, "https://www.googleapis.com/auth/drive");
          const driveResult = await createClientDriveFolder(supabaseClient, driveToken, booking);

          if (driveResult?.subfolderLink) {
            driveFolderLink = driveResult.subfolderLink;
          }
        } catch (e) {
          logStep("Drive folder creation failed", { error: e instanceof Error ? e.message : String(e) });
        }
      }

      // Add event to the studio agenda (best effort) - only if not requiring confirmation
      if (isStudioSession && serviceAccountKey && studioCalendarId) {
        try {
          const calendarToken = await getGoogleAccessToken(serviceAccountKey, "https://www.googleapis.com/auth/calendar");
          await addToStudioGoogleCalendar(calendarToken, studioCalendarId, booking);
        } catch (e) {
          logStep("Studio calendar insertion failed", { error: e instanceof Error ? e.message : String(e) });
        }
      }
    }

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
    if (driveFolderLink) {
      driveFolderSection = `
        <div style="background: #262626; padding: 15px; border-radius: 8px; margin-top: 15px;">
          <h4 style="color: #fafafa; margin: 0 0 10px 0;">📁 Votre dossier Google Drive</h4>
          <p style="color: #a1a1aa; margin: 0 0 10px 0; font-size: 14px;">
            Déposez vos fichiers audio (instrus, références, voix, etc.) dans ce dossier partagé :
          </p>
          <a href="${escapeHtml(driveFolderLink)}" style="display: inline-block; background: #22d3ee; color: #1a1a1a; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Ouvrir le dossier Drive
          </a>
        </div>
      `;
    }

    // ---------- 1. EMAIL TO ADMIN ----------
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@studiomakemusic.com";
    const fromAddress = fromEmail.includes("<") ? fromEmail : `Make Music Studio <${fromEmail}>`;

    const adminEmails = [
      "prod.makemusic@gmail.com",
      "kazamzamka@gmail.com",
      "romain.scheyvaerts@gmail.com",
    ];

    logStep("Sending admin notification", { to: adminEmails, from: fromAddress, requiresConfirmation });

    // Build confirmation buttons for 24h bookings
    let confirmationButtonsHtml = "";
    if (requiresConfirmation && booking.validationToken) {
      const baseUrl = "https://aafjeezfrmxssehnpwct.supabase.co/functions/v1/handle-booking-action";
      const confirmUrl = `${baseUrl}?token=${booking.validationToken}&action=confirm`;
      const rejectUrl = `${baseUrl}?token=${booking.validationToken}&action=reject`;
      
      confirmationButtonsHtml = `
        <div style="background: #fef3c7; border: 2px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #92400e; margin: 0 0 15px 0;">⚠️ RÉSERVATION À MOINS DE 24H - ACTION REQUISE</h3>
          <p style="color: #78350f; margin: 0 0 20px 0;">
            Cette réservation est à moins de 24 heures. Veuillez confirmer ou refuser :
          </p>
          <div style="display: flex; gap: 15px; justify-content: center;">
            <a href="${confirmUrl}" 
               style="display: inline-block; background: #10b981; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
              ✅ CONFIRMER
            </a>
            <a href="${rejectUrl}" 
               style="display: inline-block; background: #ef4444; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
              ❌ REFUSER
            </a>
          </div>
          <p style="color: #92400e; margin: 15px 0 0 0; font-size: 12px; text-align: center;">
            ⏰ Temps restant avant la session : ${Math.round(hoursUntilSession)} heures
          </p>
        </div>
      `;
    }

    const adminSubject = requiresConfirmation 
      ? `⚠️ [URGENT -24H] Réservation à confirmer - ${escapeHtml(booking.clientName)}`
      : `🎵 Nouvelle réservation [${bookedBy}] - ${escapeHtml(booking.clientName)}`;

    const { data: adminEmailData, error: adminEmailError } = await resend.emails.send({
      from: fromAddress,
      to: adminEmails,
      reply_to: "prod.makemusic@gmail.com",
      subject: adminSubject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a1a; color: #fafafa;">
          <h2 style="color: #22d3ee; margin-bottom: 20px;">
            ${requiresConfirmation ? "⚠️ Réservation à confirmer (-24h)" : `Nouvelle réservation ${bookedBy === "ADMIN" ? "(Admin)" : ""}`}
          </h2>

          ${confirmationButtonsHtml}

          <div style="background: #262626; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
            <h3 style="color: #fafafa; margin-top: 0;">👤 Informations client</h3>
            <p><strong>Nom :</strong> ${escapeHtml(booking.clientName)}</p>
            <p><strong>Email :</strong> <a href="mailto:${escapeHtml(booking.clientEmail)}" style="color: #22d3ee;">${escapeHtml(booking.clientEmail)}</a></p>
            <p><strong>Téléphone :</strong> ${booking.clientPhone ? `<a href="tel:${escapeHtml(booking.clientPhone)}" style="color: #22d3ee;">${escapeHtml(booking.clientPhone)}</a>` : "<span style='color: #a1a1aa;'>Non fourni</span>"}</p>
          </div>

          <div style="background: #262626; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
            <h3 style="color: #fafafa; margin-top: 0;">📅 Détails de la session</h3>
            <p><strong>Type :</strong> ${escapeHtml(sessionLabel)}</p>
            <p><strong>Date :</strong> ${escapeHtml(booking.date)}</p>
            <p><strong>Heure :</strong> ${escapeHtml(booking.time)}</p>
            ${booking.duration ? `<p><strong>Durée :</strong> ${booking.duration} heure(s)</p>` : ""}
          </div>

          <div style="background: #22d3ee; color: #1a1a1a; padding: 20px; border-radius: 8px; text-align: center;">
            <h3 style="margin: 0 0 10px 0;">💰 ${booking.isCashPayment ? "À payer au studio" : booking.isDeposit ? "Acompte payé" : "Montant total"}</h3>
            <p style="font-size: 28px; font-weight: bold; margin: 0;">${booking.totalPrice}€</p>
          </div>

          ${identitySection}

          <p style="margin-top: 20px; color: #a1a1aa; font-size: 12px; text-align: center;">
            Réservation reçue le ${new Date().toLocaleDateString("fr-BE", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      `,
    });

    if (adminEmailError) {
      logStep("Admin email error", adminEmailError);
    } else {
      logStep("Admin email sent", { id: adminEmailData?.id });
    }

    // ---------- 2. EMAIL TO CLIENT ----------
    logStep("Sending client email", { to: booking.clientEmail, requiresConfirmation });

    // Different email content based on whether confirmation is required
    let clientSubject: string;
    let clientHtmlContent: string;

    if (requiresConfirmation) {
      // Email for bookings requiring confirmation
      clientSubject = "⏳ Réservation en attente de confirmation - Make Music Studio";
      clientHtmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a1a; color: #fafafa;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Make Music Studio</h1>
            <p style="color: #a1a1aa; margin-top: 5px;">Bruxelles, Belgique</p>
          </div>

          <div style="background: #fef3c7; border: 2px solid #f59e0b; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #92400e; margin: 0 0 10px 0;">⏳ En attente de confirmation</h2>
            <p style="color: #78350f; margin: 0;">
              Votre réservation étant à moins de 24h, elle doit être confirmée par notre équipe.<br>
              Vous recevrez un email de confirmation ou d'annulation très prochainement.
            </p>
          </div>

          <h3 style="color: #22d3ee; margin-bottom: 15px;">Bonjour ${escapeHtml(booking.clientName)},</h3>

          <p style="color: #fafafa; margin-bottom: 20px;">
            Merci pour votre demande de réservation. Voici les détails :
          </p>

          <div style="background: #262626; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
            <h3 style="color: #fafafa; margin-top: 0;">📅 Session demandée</h3>
            <p><strong>Type :</strong> ${escapeHtml(sessionLabel)}</p>
            <p><strong>Date :</strong> ${escapeHtml(booking.date)}</p>
            <p><strong>Heure :</strong> ${escapeHtml(booking.time)}</p>
            ${booking.duration ? `<p><strong>Durée :</strong> ${booking.duration} heure(s)</p>` : ""}
          </div>

          <div style="background: #fbbf24; color: #1a1a1a; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 15px;">
            <p style="font-size: 16px; margin: 0 0 5px 0; font-weight: bold;">💰 Montant réservé</p>
            <p style="font-size: 28px; font-weight: bold; margin: 0;">${booking.totalPrice}€</p>
            <p style="font-size: 12px; margin: 5px 0 0 0;">
              En cas de refus, vous serez intégralement remboursé.
            </p>
          </div>

          ${isStudioSession ? `
          <div style="text-align: center; margin: 20px 0;">
            <p style="color: #a1a1aa; margin-bottom: 10px; font-size: 14px;">
              En attendant la confirmation, vous pouvez déjà préparer votre agenda :
            </p>
            <a href="${googleCalendarLink}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #22d3ee 0%, #0ea5e9 100%); color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 4px 14px rgba(34, 211, 238, 0.3);">
              📅 Ajouter à mon calendrier
            </a>
          </div>
          ` : ""}

          <div style="background: #262626; padding: 15px; border-radius: 8px; margin-top: 15px;">
            <h4 style="color: #fafafa; margin: 0 0 10px 0;">📞 Une question ?</h4>
            <p style="color: #a1a1aa; margin: 0; font-size: 14px;">
              Téléphone : <a href="tel:+32476094172" style="color: #22d3ee;">+32 476 09 41 72</a><br>
              Email : <a href="mailto:prod.makemusic@gmail.com" style="color: #22d3ee;">prod.makemusic@gmail.com</a>
            </p>
          </div>

          <p style="margin-top: 30px; color: #a1a1aa; font-size: 12px; text-align: center;">
            L'équipe Make Music
          </p>
        </div>
      `;
    } else {
      // Standard confirmation email
      clientSubject = "✅ Confirmation de réservation - Make Music Studio";
      clientHtmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a1a; color: #fafafa;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Make Music Studio</h1>
            <p style="color: #a1a1aa; margin-top: 5px;">Bruxelles, Belgique</p>
          </div>

          <h2 style="color: #22d3ee; margin-bottom: 20px;">Merci pour votre réservation, ${escapeHtml(booking.clientName)} !</h2>

          <p style="color: #fafafa; margin-bottom: 20px;">
            Votre demande a bien été reçue. Voici les détails :
          </p>

          <div style="background: #262626; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
            <h3 style="color: #fafafa; margin-top: 0;">📅 Votre session</h3>
            <p><strong>Type :</strong> ${escapeHtml(sessionLabel)}</p>
            <p><strong>Date :</strong> ${escapeHtml(booking.date)}</p>
            <p><strong>Heure :</strong> ${escapeHtml(booking.time)}</p>
            ${booking.duration ? `<p><strong>Durée :</strong> ${booking.duration} heure(s)</p>` : ""}
          </div>

          <div style="background: ${booking.isCashPayment ? "#fbbf24" : "#22d3ee"}; color: #1a1a1a; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 15px;">
            <p style="font-size: 16px; margin: 0 0 5px 0; font-weight: bold;">
              ${booking.isCashPayment ? "💵 À payer au studio" : "💳 Paiement"}
            </p>
            <p style="font-size: 28px; font-weight: bold; margin: 0;">${booking.totalPrice}€</p>
            ${booking.isDeposit && !booking.isCashPayment ? '<p style="font-size: 12px; margin: 5px 0 0 0;">Acompte - Reste à payer au studio</p>' : ""}
          </div>

          ${driveFolderSection}

          <div style="background: #262626; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
            <h3 style="color: #fafafa; margin-top: 0;">📍 Adresse du studio</h3>
            <p style="color: #fafafa; margin: 0;">
              <strong>Rue du Sceptre 22</strong><br>
              1050 Ixelles, Bruxelles
            </p>
            <a href="https://maps.google.com/?q=Rue+du+Sceptre+22,+1050+Ixelles,+Bruxelles" style="display: inline-block; margin-top: 10px; color: #22d3ee; text-decoration: underline;">
              Voir sur Google Maps
            </a>
          </div>

          ${isStudioSession ? `
          <div style="text-align: center; margin: 20px 0;">
            <a href="${googleCalendarLink}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #22d3ee 0%, #0ea5e9 100%); color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 4px 14px rgba(34, 211, 238, 0.3);">
              📅 Ajouter à mon calendrier
            </a>
          </div>
          ` : ""}

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
      `;
    }

    const { data: clientEmailData, error: clientEmailError } = await resend.emails.send({
      from: fromAddress,
      to: [booking.clientEmail],
      reply_to: "prod.makemusic@gmail.com",
      subject: clientSubject,
      html: clientHtmlContent,
    });

    if (clientEmailError) {
      logStep("Client email error", clientEmailError);
      throw clientEmailError;
    }

    logStep("Client email sent", { id: clientEmailData?.id });

    return new Response(JSON.stringify({ success: true, requiresConfirmation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    logStep("Error", { error: error instanceof Error ? error.message : String(error) });
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
