import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

interface ICalEvent {
  uid: string;
  summary: string;
  start: Date;
  end: Date;
}

interface BookingRequest {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  sessionType: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  amount: number;
  stripePaymentIntentId: string;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-BOOKING] ${step}${detailsStr}`);
};

// --- Google helpers (service account) ---
const base64UrlEncode = (input: string | ArrayBuffer) => {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const importPrivateKey = async (pem: string) => {
  const clean = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const raw = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)).buffer;
  return crypto.subtle.importKey(
    "pkcs8",
    raw,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
};

const getGoogleAccessToken = async (): Promise<string> => {
  const saRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
  if (!saRaw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not set");

  const sa = JSON.parse(saRaw);
  const now = Math.floor(Date.now() / 1000);

  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: sa.client_email,
      scope: GOOGLE_CALENDAR_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 60 * 55,
    }),
  );

  const toSign = `${header}.${payload}`;
  const key = await importPrivateKey(sa.private_key);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(toSign),
  );

  const jwt = `${toSign}.${base64UrlEncode(signature)}`;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Google token error: ${json?.error || res.status}`);
  }
  return json.access_token as string;
};

const createGoogleCalendarEvent = async (booking: any) => {
  const calendarId = Deno.env.get("GOOGLE_STUDIO_CALENDAR_ID");
  if (!calendarId) throw new Error("GOOGLE_STUDIO_CALENDAR_ID is not set");

  const accessToken = await getGoogleAccessToken();

  const date = booking.session_date; // YYYY-MM-DD
  const start = `${date}T${booking.start_time}:00`;
  const end = `${date}T${booking.end_time}:00`;

  const summaryPrefix = booking.status === "pending_validation" ? "[PENDING] " : "";

  const payload = {
    summary: `${summaryPrefix}Make Music Studio — ${booking.session_type} — ${booking.client_name}`,
    description: `Client: ${booking.client_name}\nEmail: ${booking.client_email}\nTéléphone: ${booking.client_phone || "-"}\nMontant payé: ${booking.amount_paid}€\nBooking ID: ${booking.id}`,
    start: { dateTime: start, timeZone: "Europe/Brussels" },
    end: { dateTime: end, timeZone: "Europe/Brussels" },
  };

  const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Google Calendar error: ${json?.error?.message || res.status}`);
  }

  return { id: json.id as string };
};

// Parse iCal date strings
function parseICalDate(dateStr: string): Date {
  if (!dateStr) return new Date(0);
  
  // Format: YYYYMMDDTHHMMSSZ or YYYYMMDD
  const cleaned = dateStr.replace(/[^0-9T]/g, '');
  
  if (cleaned.length === 8) {
    // Date only format
    const year = parseInt(cleaned.substring(0, 4));
    const month = parseInt(cleaned.substring(4, 6)) - 1;
    const day = parseInt(cleaned.substring(6, 8));
    return new Date(year, month, day);
  } else if (cleaned.length >= 15) {
    // Full datetime format
    const year = parseInt(cleaned.substring(0, 4));
    const month = parseInt(cleaned.substring(4, 6)) - 1;
    const day = parseInt(cleaned.substring(6, 8));
    const hour = parseInt(cleaned.substring(9, 11));
    const minute = parseInt(cleaned.substring(11, 13));
    const second = parseInt(cleaned.substring(13, 15));
    
    if (dateStr.endsWith('Z')) {
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    }
    return new Date(year, month, day, hour, minute, second);
  }
  
  return new Date(dateStr);
}

// Fetch and parse iCal events from Claridge calendar
async function fetchClaridgeEvents(icalUrl: string, targetDate: Date): Promise<ICalEvent[]> {
  try {
    const response = await fetch(icalUrl);
    if (!response.ok) {
      logStep("Failed to fetch iCal", { status: response.status });
      return [];
    }
    
    const icalData = await response.text();
    const events: ICalEvent[] = [];
    
    // Simple iCal parser
    const eventBlocks = icalData.split('BEGIN:VEVENT');
    
    for (let i = 1; i < eventBlocks.length; i++) {
      const block = eventBlocks[i];
      const endIndex = block.indexOf('END:VEVENT');
      const eventData = block.substring(0, endIndex);
      
      const uidMatch = eventData.match(/UID:(.+)/);
      const summaryMatch = eventData.match(/SUMMARY:(.+)/);
      const dtStartMatch = eventData.match(/DTSTART(?:;[^:]+)?:(.+)/);
      const dtEndMatch = eventData.match(/DTEND(?:;[^:]+)?:(.+)/);
      
      if (dtStartMatch && dtEndMatch) {
        const start = parseICalDate(dtStartMatch[1].trim());
        const end = parseICalDate(dtEndMatch[1].trim());
        
        // Filter for events on the target date
        const targetDateStr = targetDate.toISOString().split('T')[0];
        const eventDateStr = start.toISOString().split('T')[0];
        
        if (eventDateStr === targetDateStr) {
          events.push({
            uid: uidMatch ? uidMatch[1].trim() : '',
            summary: summaryMatch ? summaryMatch[1].trim() : 'Event',
            start,
            end
          });
        }
      }
    }
    
    logStep("Parsed Claridge events", { count: events.length, targetDate: targetDate.toISOString().split('T')[0] });
    return events;
  } catch (error) {
    logStep("Error fetching iCal", { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

// Check if booking overlaps with any Claridge events
function hasConflict(claridgeEvents: ICalEvent[], bookingStart: Date, bookingEnd: Date): boolean {
  for (const event of claridgeEvents) {
    // Check for overlap
    if (bookingStart < event.end && bookingEnd > event.start) {
      logStep("Conflict detected", { 
        event: event.summary, 
        eventStart: event.start.toISOString(),
        eventEnd: event.end.toISOString(),
        bookingStart: bookingStart.toISOString(),
        bookingEnd: bookingEnd.toISOString()
      });
      return true;
    }
  }
  return false;
}

// Send admin notification email with action buttons
async function sendAdminNotification(
  resend: Resend,
  booking: any,
  hasConflict: boolean,
  appUrl: string
): Promise<void> {
  const confirmUrl = `${appUrl}/booking-action?token=${booking.validation_token}&action=confirm`;
  const rejectUrl = `${appUrl}/booking-action?token=${booking.validation_token}&action=reject`;
  
  const sessionDate = new Date(booking.session_date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const conflictWarning = hasConflict ? `
    <div style="background-color: #FEE2E2; border: 1px solid #EF4444; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
      <h3 style="color: #DC2626; margin: 0 0 8px 0;">⚠️ CONFLIT DÉTECTÉ</h3>
      <p style="color: #7F1D1D; margin: 0;">Ce créneau chevauche un événement sur le calendrier Claridge. Validation prioritaire requise.</p>
    </div>
  ` : '';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 12px; color: white; text-align: center; margin-bottom: 20px;">
        <h1 style="margin: 0;">Make Music Studio</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.8;">Nouvelle réservation reçue</p>
      </div>
      
      ${conflictWarning}
      
      <div style="background-color: #F8FAFC; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h2 style="margin: 0 0 16px 0; color: #1E293B;">Détails de la réservation</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748B;">Client</td>
            <td style="padding: 8px 0; color: #1E293B; text-align: right; font-weight: 500;">${booking.client_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748B;">Email</td>
            <td style="padding: 8px 0; color: #1E293B; text-align: right;">${booking.client_email}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748B;">Téléphone</td>
            <td style="padding: 8px 0; color: #1E293B; text-align: right;">${booking.client_phone || 'Non fourni'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748B;">Type de session</td>
            <td style="padding: 8px 0; color: #1E293B; text-align: right; font-weight: 500;">${booking.session_type}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748B;">Date</td>
            <td style="padding: 8px 0; color: #1E293B; text-align: right; font-weight: 500;">${sessionDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748B;">Horaire</td>
            <td style="padding: 8px 0; color: #1E293B; text-align: right; font-weight: 500;">${booking.start_time} - ${booking.end_time}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748B;">Durée</td>
            <td style="padding: 8px 0; color: #1E293B; text-align: right;">${booking.duration_hours}h</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748B;">Montant payé</td>
            <td style="padding: 8px 0; color: #10B981; text-align: right; font-weight: 600;">${booking.amount_paid}€</td>
          </tr>
        </table>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${confirmUrl}" style="display: inline-block; background-color: #10B981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 0 10px;">
          ✓ Confirmer la session
        </a>
        <a href="${rejectUrl}" style="display: inline-block; background-color: #EF4444; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 0 10px;">
          ✗ Problème / Remboursement
        </a>
      </div>
      
      <p style="color: #64748B; font-size: 12px; text-align: center; margin-top: 30px;">
        Cet email a été envoyé automatiquement par le système de réservation Make Music Studio.
      </p>
    </body>
    </html>
  `;
  
  await resend.emails.send({
    from: 'Make Music Studio <onboarding@resend.dev>',
    to: ['prod.makemusic@gmail.com', 'romain.scheyvaerts@gmail.com'],
    subject: hasConflict 
      ? `⚠️ CONFLIT - Nouvelle réservation de ${booking.client_name}` 
      : `Nouvelle réservation de ${booking.client_name}`,
    html
  });
  
  logStep("Admin notification sent", { hasConflict });
}

// Send client confirmation email
async function sendClientConfirmation(
  resend: Resend,
  booking: any
): Promise<void> {
  const sessionDate = new Date(booking.session_date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 12px; color: white; text-align: center; margin-bottom: 20px;">
        <h1 style="margin: 0;">Make Music Studio</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.8;">Confirmation de réservation</p>
      </div>
      
      <div style="background-color: #ECFDF5; border: 1px solid #10B981; border-radius: 8px; padding: 16px; margin-bottom: 20px; text-align: center;">
        <h2 style="color: #059669; margin: 0;">✓ Paiement reçu</h2>
        <p style="color: #047857; margin: 8px 0 0 0;">Votre réservation est en cours de traitement</p>
      </div>
      
      <div style="background-color: #F8FAFC; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 16px 0; color: #1E293B;">Récapitulatif</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748B;">Type de session</td>
            <td style="padding: 8px 0; color: #1E293B; text-align: right; font-weight: 500;">${booking.session_type}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748B;">Date</td>
            <td style="padding: 8px 0; color: #1E293B; text-align: right; font-weight: 500;">${sessionDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748B;">Horaire</td>
            <td style="padding: 8px 0; color: #1E293B; text-align: right; font-weight: 500;">${booking.start_time} - ${booking.end_time}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748B;">Durée</td>
            <td style="padding: 8px 0; color: #1E293B; text-align: right;">${booking.duration_hours}h</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748B;">Montant</td>
            <td style="padding: 8px 0; color: #10B981; text-align: right; font-weight: 600;">${booking.amount_paid}€</td>
          </tr>
        </table>
      </div>
      
      <p style="color: #475569; line-height: 1.6;">
        Bonjour ${booking.client_name},<br><br>
        Nous avons bien reçu votre paiement et votre demande de réservation. 
        Vous recevrez une confirmation finale par email très prochainement.<br><br>
        En cas de question, n'hésitez pas à nous contacter.
      </p>
      
      <p style="color: #64748B; font-size: 12px; text-align: center; margin-top: 30px;">
        Make Music Studio - Bruxelles
      </p>
    </body>
    </html>
  `;
  
  await resend.emails.send({
    from: 'Make Music Studio <onboarding@resend.dev>',
    to: [booking.client_email],
    subject: `Réservation reçue - ${sessionDate}`,
    html
  });
  
  logStep("Client confirmation sent", { email: booking.client_email });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const claridgeIcalUrl = Deno.env.get("CLARIDGE_ICAL_URL");
    
    const body: BookingRequest = await req.json();
    logStep("Request body received", body);
    
    // Parse booking date and times
    const bookingDate = new Date(body.sessionDate);
    const [startHour, startMin] = body.startTime.split(':').map(Number);
    const [endHour, endMin] = body.endTime.split(':').map(Number);
    
    const bookingStart = new Date(bookingDate);
    bookingStart.setHours(startHour, startMin, 0, 0);
    
    const bookingEnd = new Date(bookingDate);
    bookingEnd.setHours(endHour, endMin, 0, 0);
    
    // Fetch Claridge events and check for conflicts
    let conflictDetected = false;
    if (claridgeIcalUrl) {
      const claridgeEvents = await fetchClaridgeEvents(claridgeIcalUrl, bookingDate);
      conflictDetected = hasConflict(claridgeEvents, bookingStart, bookingEnd);
    } else {
      logStep("No Claridge iCal URL configured, skipping conflict check");
    }
    
    // Insert booking into database
    const { data: booking, error: insertError } = await supabaseClient
      .from('bookings')
      .insert({
        client_name: body.clientName,
        client_email: body.clientEmail,
        client_phone: body.clientPhone,
        session_type: body.sessionType,
        session_date: body.sessionDate,
        start_time: body.startTime,
        end_time: body.endTime,
        duration_hours: body.durationHours,
        amount_paid: body.amount,
        stripe_payment_intent_id: body.stripePaymentIntentId,
        status: conflictDetected ? 'pending_validation' : 'confirmed',
        has_conflict: conflictDetected
      })
      .select()
      .single();
    
    if (insertError) {
      logStep("Insert error", { error: insertError.message });
      throw new Error(`Failed to create booking: ${insertError.message}`);
    }
    
    logStep("Booking created", { id: booking.id, hasConflict: conflictDetected });
    
    // Get app URL for action buttons
    const appUrl = req.headers.get("origin") || "https://makemusicstudio.be";
    
    // Send emails
    await sendAdminNotification(resend, booking, conflictDetected, appUrl);
    await sendClientConfirmation(resend, booking);
    
    // Add to Google Calendar
    try {
      const calendarEvent = await createGoogleCalendarEvent(booking);
      await supabaseClient
        .from('bookings')
        .update({ google_calendar_event_id: calendarEvent.id })
        .eq('id', booking.id);
      logStep("Google Calendar event created", { eventId: calendarEvent.id });
    } catch (calendarError) {
      logStep("Google Calendar ERROR", { message: calendarError instanceof Error ? calendarError.message : String(calendarError) });
      // We don't fail the booking if calendar insert fails
    }

    return new Response(JSON.stringify({
      success: true,
      bookingId: booking.id,
      hasConflict: conflictDetected,
      status: booking.status
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
