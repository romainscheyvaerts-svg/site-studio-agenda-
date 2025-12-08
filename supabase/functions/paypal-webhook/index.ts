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

// ============ GOOGLE CALENDAR INTEGRATION ============

async function getAccessToken(serviceAccountKey: string): Promise<string> {
  const key = JSON.parse(serviceAccountKey);
  
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  
  const base64UrlEncode = (data: Uint8Array): string => {
    const base64 = btoa(String.fromCharCode(...data));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const claimB64 = base64UrlEncode(encoder.encode(JSON.stringify(claim)));
  const signatureInput = `${headerB64}.${claimB64}`;

  const pemContents = key.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");
  
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  
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

  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  const jwt = `${signatureInput}.${signatureB64}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResponse.json();
  
  if (!tokenData.access_token) {
    console.error("Token response:", tokenData);
    throw new Error("Failed to get access token");
  }
  
  return tokenData.access_token;
}

async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: {
    summary: string;
    description: string;
    start: string;
    end: string;
    attendeeEmail?: string;
  }
): Promise<void> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

  const eventBody: Record<string, unknown> = {
    summary: event.summary,
    description: event.description,
    start: {
      dateTime: event.start,
      timeZone: "Europe/Brussels",
    },
    end: {
      dateTime: event.end,
      timeZone: "Europe/Brussels",
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 60 },
        { method: "popup", minutes: 30 },
      ],
    },
  };

  // Add attendee if email provided
  if (event.attendeeEmail) {
    eventBody.attendees = [{ email: event.attendeeEmail }];
  }

  console.log(`[CALENDAR] Creating event on calendar: ${calendarId}`);
  console.log(`[CALENDAR] Event: ${event.summary}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[CALENDAR] Error creating event:`, errorText);
    throw new Error(`Failed to create calendar event: ${response.status}`);
  }

  const createdEvent = await response.json();
  console.log(`[CALENDAR] Event created successfully: ${createdEvent.id}`);
}

// ============ EMAIL FUNCTIONS ============

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

// ============ MAIN HANDLER ============

serve(async (req) => {
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

    // Get Google Calendar credentials
    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    const studioCalendarId = Deno.env.get("GOOGLE_STUDIO_CALENDAR_ID");

    // ACTION 1: Create Google Calendar event
    if (serviceAccountKey && studioCalendarId) {
      try {
        const accessToken = await getAccessToken(serviceAccountKey);
        
        // Parse date and time for calendar event
        const [year, month, day] = payload.date.split("-").map(Number);
        const [hour, minute] = payload.time.split(":").map(Number);
        
        const startDate = new Date(year, month - 1, day, hour, minute);
        const endDate = new Date(startDate.getTime() + payload.hours * 60 * 60 * 1000);
        
        // Format as ISO string with timezone offset
        const formatForCalendar = (date: Date): string => {
          return date.toISOString().replace('Z', '+01:00');
        };

        const eventDescription = [
          `Client: ${payload.payerName}`,
          `Email: ${payload.payerEmail}`,
          `Téléphone: ${payload.phone}`,
          `Durée: ${payload.hours}h`,
          `Montant: ${payload.totalAmount}€`,
          `Référence: ${payload.orderId}`,
          payload.message ? `Message: ${payload.message}` : '',
        ].filter(Boolean).join('\n');

        await createCalendarEvent(accessToken, studioCalendarId, {
          summary: `SESSION ${sessionLabel} - ${payload.payerName}`,
          description: eventDescription,
          start: formatForCalendar(startDate),
          end: formatForCalendar(endDate),
          attendeeEmail: payload.payerEmail,
        });

        console.log("[CALENDAR] Event created successfully");
      } catch (calendarError) {
        console.error("[CALENDAR] Failed to create event:", calendarError);
        // Don't fail the whole webhook if calendar fails
      }
    } else {
      console.log("[CALENDAR] Missing calendar configuration, skipping event creation");
    }

    // ACTION 2: Send confirmation email to client
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
