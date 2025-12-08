import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Supabase client with service role for database operations
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface BookingPayload {
  orderId: string;
  payerName: string;
  payerEmail: string;
  phone: string;
  sessionType: "with-engineer" | "without-engineer" | "mixing" | "mastering" | "analog-mastering";
  date: string;
  time: string;
  hours: number;
  totalAmount: number;
  message?: string;
}

interface CalendarEvent {
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

interface CalendarResponse {
  items?: CalendarEvent[];
}

// ============ GOOGLE CALENDAR INTEGRATION ============

async function getAccessToken(serviceAccountKey: string, scopes: string[]): Promise<string> {
  const key = JSON.parse(serviceAccountKey);
  
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: key.client_email,
    scope: scopes.join(" "),
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

// ============ CALENDAR AVAILABILITY FOR INTERNAL WORK SESSIONS ============

async function getCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[CALENDAR] Error fetching events:`, errorText);
    return [];
  }

  const data: CalendarResponse = await response.json();
  return data.items || [];
}

function isSlotAvailable(
  events: CalendarEvent[],
  slotStart: Date,
  slotEnd: Date
): boolean {
  for (const event of events) {
    const eventStart = new Date(event.start.dateTime || event.start.date || "");
    const eventEnd = new Date(event.end.dateTime || event.end.date || "");
    
    // Check for overlap
    if (eventStart < slotEnd && eventEnd > slotStart) {
      return false;
    }
  }
  return true;
}

function hasAllDayEvent(events: CalendarEvent[], date: Date): boolean {
  const dateStr = date.toISOString().split('T')[0];
  
  for (const event of events) {
    // All-day events have only 'date' property, not 'dateTime'
    if (event.start.date && !event.start.dateTime) {
      if (event.start.date === dateStr) {
        return true;
      }
    }
    // Also check for events that span the whole day
    if (event.start.dateTime && event.end.dateTime) {
      const eventStart = new Date(event.start.dateTime);
      const eventEnd = new Date(event.end.dateTime);
      const hours = (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60);
      if (hours >= 8) {
        // Consider it blocks the whole day
        return true;
      }
    }
  }
  return false;
}

async function findAvailableSlots(
  accessToken: string,
  patronCalendarId: string,
  studioCalendarId: string,
  durationHours: number,
  count: number
): Promise<Date[]> {
  const slots: Date[] = [];
  const now = new Date();
  let currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  currentDate.setDate(currentDate.getDate() + 1); // Start from tomorrow
  
  const maxDaysToCheck = 30;
  let daysChecked = 0;

  console.log(`[WORK-SESSIONS] Looking for ${count} slots of ${durationHours}h each (optimized for adjacent booking)`);

  // First pass: collect all days with existing studio events
  const daysWithBookings: { date: Date; events: CalendarEvent[] }[] = [];
  const daysWithoutBookings: { date: Date; events: CalendarEvent[] }[] = [];

  const tempDate = new Date(currentDate);
  for (let i = 0; i < maxDaysToCheck; i++) {
    const dayStart = new Date(tempDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(tempDate);
    dayEnd.setHours(23, 59, 59, 999);

    const [patronEvents, studioEvents] = await Promise.all([
      getCalendarEvents(accessToken, patronCalendarId, dayStart.toISOString(), dayEnd.toISOString()),
      getCalendarEvents(accessToken, studioCalendarId, dayStart.toISOString(), dayEnd.toISOString()),
    ]);

    // Skip if patron has all-day event (Claridge blocks entire day)
    if (hasAllDayEvent(patronEvents, tempDate)) {
      console.log(`[WORK-SESSIONS] ${tempDate.toDateString()} - Patron busy all day, skipping`);
      tempDate.setDate(tempDate.getDate() + 1);
      continue;
    }

    const allEvents = [...patronEvents, ...studioEvents];
    
    // Check if there are timed studio events (actual bookings, not all-day)
    const hasTimedBookings = studioEvents.some(e => e.start.dateTime && !e.start.date);
    
    if (hasTimedBookings) {
      daysWithBookings.push({ date: new Date(tempDate), events: allEvents });
    } else {
      daysWithoutBookings.push({ date: new Date(tempDate), events: allEvents });
    }

    tempDate.setDate(tempDate.getDate() + 1);
  }

  console.log(`[WORK-SESSIONS] Found ${daysWithBookings.length} days with existing bookings, ${daysWithoutBookings.length} without`);

  // Helper to find adjacent slots (just before or after existing events)
  const findAdjacentSlot = (
    events: CalendarEvent[],
    date: Date,
    durationHours: number
  ): Date | null => {
    // Get all timed events sorted by start time
    const timedEvents = events
      .filter(e => e.start.dateTime)
      .map(e => ({
        start: new Date(e.start.dateTime!),
        end: new Date(e.end.dateTime!)
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    if (timedEvents.length === 0) return null;

    // Try to place work session BEFORE the first booking of the day
    for (const event of timedEvents) {
      const slotEnd = new Date(event.start); // End right when the booking starts
      const slotStart = new Date(slotEnd.getTime() - durationHours * 60 * 60 * 1000);
      
      // Check if slot is within working hours (10:00 - 23:00)
      if (slotStart.getHours() >= 10 && slotEnd.getHours() <= 23) {
        // Check if this slot is available
        if (isSlotAvailable(events, slotStart, slotEnd)) {
          console.log(`[WORK-SESSIONS] Found BEFORE-adjacent slot: ${slotStart.toISOString()}`);
          return slotStart;
        }
      }
    }

    // Try to place work session AFTER the last booking of the day
    for (let i = timedEvents.length - 1; i >= 0; i--) {
      const event = timedEvents[i];
      const slotStart = new Date(event.end); // Start right when the booking ends
      const slotEnd = new Date(slotStart.getTime() + durationHours * 60 * 60 * 1000);
      
      // Check if slot is within working hours (10:00 - 23:00)
      if (slotStart.getHours() >= 10 && slotEnd.getHours() <= 23) {
        // Check if this slot is available
        if (isSlotAvailable(events, slotStart, slotEnd)) {
          console.log(`[WORK-SESSIONS] Found AFTER-adjacent slot: ${slotStart.toISOString()}`);
          return slotStart;
        }
      }
    }

    return null;
  };

  // Helper to find any available slot in a day
  const findAnySlot = (
    events: CalendarEvent[],
    date: Date,
    durationHours: number
  ): Date | null => {
    for (let hour = 10; hour <= 23 - durationHours; hour++) {
      const slotStart = new Date(date);
      slotStart.setHours(hour, 0, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setHours(hour + durationHours, 0, 0, 0);

      if (isSlotAvailable(events, slotStart, slotEnd)) {
        return slotStart;
      }
    }
    return null;
  };

  // PRIORITY 1: Days with existing bookings - find adjacent slots
  for (const day of daysWithBookings) {
    if (slots.length >= count) break;

    const adjacentSlot = findAdjacentSlot(day.events, day.date, durationHours);
    if (adjacentSlot) {
      slots.push(adjacentSlot);
      console.log(`[WORK-SESSIONS] Scheduled adjacent to booking: ${adjacentSlot.toISOString()}`);
      
      // Mark this slot as taken for future searches
      day.events.push({
        start: { dateTime: adjacentSlot.toISOString() },
        end: { dateTime: new Date(adjacentSlot.getTime() + durationHours * 60 * 60 * 1000).toISOString() }
      });
    }
  }

  // PRIORITY 2: Days without bookings - use normal slot finding
  for (const day of daysWithoutBookings) {
    if (slots.length >= count) break;

    const slot = findAnySlot(day.events, day.date, durationHours);
    if (slot) {
      slots.push(slot);
      console.log(`[WORK-SESSIONS] Scheduled on empty day: ${slot.toISOString()}`);
      
      // Mark this slot as taken
      day.events.push({
        start: { dateTime: slot.toISOString() },
        end: { dateTime: new Date(slot.getTime() + durationHours * 60 * 60 * 1000).toISOString() }
      });
    }
  }

  // FALLBACK: If still need slots, search days with bookings for any available slot
  if (slots.length < count) {
    for (const day of daysWithBookings) {
      if (slots.length >= count) break;

      const slot = findAnySlot(day.events, day.date, durationHours);
      if (slot) {
        slots.push(slot);
        console.log(`[WORK-SESSIONS] Fallback slot on booking day: ${slot.toISOString()}`);
      }
    }
  }

  return slots;
}

async function scheduleInternalWorkSessions(
  accessToken: string,
  calendarId: string,
  patronCalendarId: string,
  studioCalendarId: string,
  sessionType: "mixing" | "mastering" | "analog-mastering",
  clientName: string,
  orderId: string
): Promise<void> {
  console.log(`[WORK-SESSIONS] Scheduling internal work sessions for ${sessionType}`);

  let sessionsToSchedule: { duration: number; label: string }[] = [];

  if (sessionType === "mixing") {
    // Mix: 2 sessions - 3h + 2h
    sessionsToSchedule = [
      { duration: 3, label: "MIX Session 1/2" },
      { duration: 2, label: "MIX Session 2/2" },
    ];
  } else if (sessionType === "mastering" || sessionType === "analog-mastering") {
    // Mastering: 1 session of 2h
    const label = sessionType === "analog-mastering" ? "MASTERING ANALOG" : "MASTERING";
    sessionsToSchedule = [
      { duration: 2, label: label },
    ];
  }

  for (const session of sessionsToSchedule) {
    const slots = await findAvailableSlots(
      accessToken,
      patronCalendarId,
      studioCalendarId,
      session.duration,
      1
    );

    if (slots.length > 0) {
      const slotStart = slots[0];
      const slotEnd = new Date(slotStart.getTime() + session.duration * 60 * 60 * 1000);

      const formatForCalendar = (date: Date): string => {
        return date.toISOString().replace('Z', '+01:00');
      };

      await createCalendarEvent(accessToken, calendarId, {
        summary: `🎛️ ${session.label} - ${clientName}`,
        description: `Session de travail interne\nClient: ${clientName}\nRéférence: ${orderId}\n\n⚠️ Session de travail - Ne pas supprimer`,
        start: formatForCalendar(slotStart),
        end: formatForCalendar(slotEnd),
      });

      console.log(`[WORK-SESSIONS] Created: ${session.label} on ${slotStart.toISOString()}`);
    } else {
      console.warn(`[WORK-SESSIONS] Could not find slot for ${session.label}`);
    }
  }
}

// ============ GOOGLE DRIVE INTEGRATION ============

interface ClientDriveFolder {
  id: string;
  client_email: string;
  client_phone: string | null;
  client_name: string;
  drive_folder_id: string;
  drive_folder_link: string;
}

async function getExistingClientFolder(email: string, phone?: string): Promise<ClientDriveFolder | null> {
  console.log(`[DRIVE] Checking for existing folder for: ${email} or ${phone}`);
  
  // Check by email first
  const { data: emailFolder, error: emailError } = await supabase
    .from("client_drive_folders")
    .select("*")
    .eq("client_email", email.toLowerCase())
    .maybeSingle();

  if (emailError) {
    console.error("[DRIVE] Error checking email folder:", emailError);
  }

  if (emailFolder) {
    console.log(`[DRIVE] Found existing folder by email: ${emailFolder.drive_folder_link}`);
    return emailFolder as ClientDriveFolder;
  }

  // Check by phone if provided
  if (phone) {
    const normalizedPhone = phone.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
    const { data: phoneFolder, error: phoneError } = await supabase
      .from("client_drive_folders")
      .select("*")
      .eq("client_phone", normalizedPhone)
      .maybeSingle();

    if (phoneError) {
      console.error("[DRIVE] Error checking phone folder:", phoneError);
    }

    if (phoneFolder) {
      console.log(`[DRIVE] Found existing folder by phone: ${phoneFolder.drive_folder_link}`);
      return phoneFolder as ClientDriveFolder;
    }
  }

  console.log("[DRIVE] No existing folder found for this client");
  return null;
}

async function saveClientFolder(
  email: string,
  phone: string | undefined,
  name: string,
  folderId: string,
  folderLink: string
): Promise<void> {
  const normalizedPhone = phone ? phone.replace(/\s+/g, "").replace(/[^0-9+]/g, "") : null;
  
  const { error } = await supabase
    .from("client_drive_folders")
    .insert({
      client_email: email.toLowerCase(),
      client_phone: normalizedPhone,
      client_name: name,
      drive_folder_id: folderId,
      drive_folder_link: folderLink,
    });

  if (error) {
    console.error("[DRIVE] Error saving client folder:", error);
    throw error;
  }

  console.log(`[DRIVE] Client folder saved to database`);
}

async function createDriveFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string
): Promise<{ id: string; webViewLink: string }> {
  console.log(`[DRIVE] Creating folder: ${folderName}`);

  const metadata: Record<string, unknown> = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };

  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const response = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,webViewLink", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[DRIVE] Error creating folder:", errorText);
    throw new Error(`Failed to create Drive folder: ${response.status}`);
  }

  const folder = await response.json();
  console.log(`[DRIVE] Folder created: ${folder.id}`);
  return folder;
}

async function shareDriveFolder(
  accessToken: string,
  folderId: string,
  email: string
): Promise<void> {
  console.log(`[DRIVE] Sharing folder ${folderId} with ${email}`);

  const permission = {
    type: "user",
    role: "writer",
    emailAddress: email,
  };

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}/permissions?sendNotificationEmail=false`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(permission),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[DRIVE] Error sharing folder:", errorText);
    throw new Error(`Failed to share Drive folder: ${response.status}`);
  }

  console.log(`[DRIVE] Folder shared successfully with ${email}`);
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

const generateConfirmationEmail = (payload: BookingPayload, driveFolderLink?: string | null): string => {
  const isPostProduction = ["mixing", "mastering", "analog-mastering"].includes(payload.sessionType);
  
  let sessionLabel = "";
  let contactInfo = "";
  
  if (payload.sessionType === "with-engineer") {
    sessionLabel = "Session avec ingénieur son";
    contactInfo = `<p style="margin: 0 0 10px 0;"><strong>Contact ingénieur :</strong> Un ingénieur vous contactera avant votre session.</p>`;
  } else if (payload.sessionType === "without-engineer") {
    sessionLabel = "Location sèche (autonomie)";
    contactInfo = `<p style="margin: 0 0 10px 0;"><strong>Contact studio :</strong> Vous recevrez les instructions d'accès par email.</p>`;
  } else if (payload.sessionType === "mixing") {
    sessionLabel = "Service Mixage";
    contactInfo = `<p style="margin: 0 0 10px 0;"><strong>Délai :</strong> Votre mixage sera traité dans un délai d'environ 2 semaines.</p>
                   <p style="margin: 0 0 10px 0;">Dès que l'ingénieur aura terminé le travail, nous vous contacterons par email ou WhatsApp pour vous proposer des dates pour la session d'écoute au studio.</p>`;
  } else if (payload.sessionType === "mastering") {
    sessionLabel = "Service Mastering";
    contactInfo = `<p style="margin: 0 0 10px 0;"><strong>Délai :</strong> Votre mastering sera traité dans un délai d'environ 2 semaines.</p>
                   <p style="margin: 0 0 10px 0;">Dès que l'ingénieur aura terminé le travail, nous vous contacterons par email ou WhatsApp pour vous proposer des dates pour la session d'écoute au studio.</p>`;
  } else if (payload.sessionType === "analog-mastering") {
    sessionLabel = "Service Mastering Analogique";
    contactInfo = `<p style="margin: 0 0 10px 0;"><strong>Délai :</strong> Votre mastering analogique sera traité dans un délai d'environ 2 semaines.</p>
                   <p style="margin: 0 0 10px 0;">Dès que l'ingénieur aura terminé le travail, nous vous contacterons par email ou WhatsApp pour vous proposer des dates pour la session d'écoute au studio.</p>`;
  }

  const driveSection = driveFolderLink ? `
              <!-- Drive Folder -->
              <tr>
                <td style="padding: 0 40px 30px 40px;">
                  <div style="background: linear-gradient(135deg, rgba(34, 211, 238, 0.1), rgba(66, 133, 244, 0.1)); border-radius: 12px; padding: 20px; border: 1px solid rgba(66, 133, 244, 0.3);">
                    <h4 style="margin: 0 0 12px 0; color: #fafafa; font-size: 16px;">📁 Votre dossier partagé</h4>
                    <p style="margin: 0 0 16px 0; color: #a1a1aa; font-size: 14px;">
                      ${isPostProduction 
                        ? "Un dossier Google Drive a été créé pour votre projet. Veuillez y déposer vos fichiers à traiter."
                        : "Un dossier Google Drive a été créé pour votre projet. Vous pouvez y déposer vos fichiers et accéder aux enregistrements après la session."
                      }
                    </p>
                    <a href="${driveFolderLink}" style="display: inline-block; background-color: #4285f4; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                      ${isPostProduction ? "Déposer mes fichiers" : "Ouvrir le dossier"}
                    </a>
                  </div>
                </td>
              </tr>
  ` : '';

  // For post-production, don't show date/time/duration
  const bookingDetailsSection = isPostProduction ? `
              <!-- Booking Details for Post-Production -->
              <tr>
                <td style="padding: 0 40px 30px 40px;">
                  <h3 style="margin: 0 0 20px 0; color: #fafafa; font-size: 18px; border-bottom: 1px solid #1e1e21; padding-bottom: 10px;">
                    Détails de votre commande
                  </h3>
                  
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding: 12px 0; border-bottom: 1px solid #1e1e21;">
                        <span style="color: #71717a; font-size: 14px;">Service</span><br>
                        <span style="color: #22d3ee; font-size: 16px; font-weight: 600;">${sessionLabel}</span>
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
  ` : `
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
  `;

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
                    ${isPostProduction ? "Confirmation de commande" : "Confirmation de réservation"}
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
                    <p style="margin: 0; color: #a1a1aa; font-size: 14px;">${isPostProduction ? "Votre commande est enregistrée" : "Votre session est réservée"}, ${payload.payerName}</p>
                  </div>
                </td>
              </tr>

              ${bookingDetailsSection}

              ${driveSection}

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
                    ${isPostProduction ? "Merci pour votre confiance !" : "À très bientôt au studio !"}
                  </p>
                  <p style="margin: 0; color: #52525b; font-size: 12px;">
                    Make Music Studio • Bruxelles • +32 476 09 41 72
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

    const isPostProduction = ["mixing", "mastering", "analog-mastering"].includes(payload.sessionType);
    
    let sessionLabel = "";
    if (payload.sessionType === "with-engineer") sessionLabel = "AVEC INGÉNIEUR";
    else if (payload.sessionType === "without-engineer") sessionLabel = "LOCATION SÈCHE";
    else if (payload.sessionType === "mixing") sessionLabel = "MIXAGE";
    else if (payload.sessionType === "mastering") sessionLabel = "MASTERING";
    else if (payload.sessionType === "analog-mastering") sessionLabel = "MASTERING ANALOGIQUE";

    // Get Google Calendar credentials
    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    const studioCalendarId = Deno.env.get("GOOGLE_STUDIO_CALENDAR_ID");
    const patronCalendarId = Deno.env.get("GOOGLE_PATRON_CALENDAR_ID");

    // ACTION 1: Handle calendar events based on session type
    if (serviceAccountKey && studioCalendarId) {
      try {
        const calendarToken = await getAccessToken(serviceAccountKey, ["https://www.googleapis.com/auth/calendar"]);
        
        if (isPostProduction) {
          // For post-production: schedule internal work sessions
          console.log("[CALENDAR] Scheduling internal work sessions for post-production");
          
          if (patronCalendarId) {
            await scheduleInternalWorkSessions(
              calendarToken,
              studioCalendarId,
              patronCalendarId,
              studioCalendarId,
              payload.sessionType as "mixing" | "mastering" | "analog-mastering",
              payload.payerName,
              payload.orderId
            );
          } else {
            console.log("[CALENDAR] Missing patron calendar ID, skipping work session scheduling");
          }
        } else {
          // For studio sessions: create client-facing event
          const [year, month, day] = payload.date.split("-").map(Number);
          const [hour, minute] = payload.time.split(":").map(Number);
          
          const startDate = new Date(year, month - 1, day, hour, minute);
          const endDate = new Date(startDate.getTime() + payload.hours * 60 * 60 * 1000);
          
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

          await createCalendarEvent(calendarToken, studioCalendarId, {
            summary: `SESSION ${sessionLabel} - ${payload.payerName}`,
            description: eventDescription,
            start: formatForCalendar(startDate),
            end: formatForCalendar(endDate),
            attendeeEmail: payload.payerEmail,
          });

          console.log("[CALENDAR] Client session event created successfully");
        }
      } catch (calendarError) {
        console.error("[CALENDAR] Failed to create event:", calendarError);
        // Don't fail the whole webhook if calendar fails
      }
    } else {
      console.log("[CALENDAR] Missing calendar configuration, skipping event creation");
    }

    // ACTION 2: Get or create Google Drive shared folder for client
    let driveFolderLink: string | null = null;
    if (serviceAccountKey) {
      try {
        // Check if client already has a folder
        const existingFolder = await getExistingClientFolder(payload.payerEmail, payload.phone);
        
        if (existingFolder) {
          // Use existing folder
          driveFolderLink = existingFolder.drive_folder_link;
          console.log(`[DRIVE] Using existing folder: ${driveFolderLink}`);
        } else {
          // Create new folder
          const driveToken = await getAccessToken(serviceAccountKey, ["https://www.googleapis.com/auth/drive"]);
          
          const folderName = `${payload.payerName} - Make Music Studio`;
          const folder = await createDriveFolder(driveToken, folderName);
          
          // Share folder with client email
          await shareDriveFolder(driveToken, folder.id, payload.payerEmail);
          
          // Save to database for future bookings
          await saveClientFolder(
            payload.payerEmail,
            payload.phone,
            payload.payerName,
            folder.id,
            folder.webViewLink
          );
          
          driveFolderLink = folder.webViewLink;
          console.log(`[DRIVE] New folder created and shared: ${driveFolderLink}`);
        }
      } catch (driveError) {
        console.error("[DRIVE] Failed to handle folder:", driveError);
        // Don't fail the whole webhook if Drive fails
      }
    } else {
      console.log("[DRIVE] Missing service account, skipping folder creation");
    }

    // ACTION 3: Send confirmation email to client (with Drive link if available)
    console.log("[EMAIL] Sending confirmation email to:", payload.payerEmail);
    
    try {
      const emailHtml = generateConfirmationEmail(payload, driveFolderLink);
      
      // Adapt email subject based on service type
      let emailSubject = "";
      if (isPostProduction) {
        emailSubject = `✅ Commande confirmée - ${sessionLabel}`;
      } else {
        emailSubject = `✅ Réservation confirmée - ${formatDate(payload.date)} à ${payload.time}`;
      }
      
      const emailResponse = await resend.emails.send({
        from: "Make Music Studio <onboarding@resend.dev>",
        to: [payload.payerEmail],
        subject: emailSubject,
        html: emailHtml,
      });

      console.log("[EMAIL] Confirmation email sent successfully:", emailResponse);
    } catch (emailError) {
      console.error("[EMAIL] Failed to send confirmation email:", emailError);
      // Don't fail the whole webhook if email fails
    }

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
