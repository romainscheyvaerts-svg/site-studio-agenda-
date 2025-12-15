import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Post-production services that don't require calendar scheduling
const POST_PRODUCTION_SERVICES = ["mixing", "mastering", "analog-mastering", "podcast"];

// Input validation schema for booking payload
const bookingPayloadSchema = z.object({
  orderId: z.string().min(1).max(100),
  payerName: z.string().trim().min(2).max(100),
  payerEmail: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional().default(""),
  sessionType: z.enum(["with-engineer", "without-engineer", "mixing", "mastering", "analog-mastering", "podcast"]),
  // Date/time optional for post-production services, required for studio sessions
  date: z.string().optional().default(""),
  time: z.string().optional().default(""),
  hours: z.number().int().min(1).max(12),
  totalAmount: z.number().min(0).max(10000),
  message: z.string().max(1000).optional(),
  podcastMinutes: z.number().int().min(1).max(180).optional(),
  isCashPayment: z.boolean().optional().default(false),
}).refine((data) => {
  // Post-production services don't need date/time
  if (POST_PRODUCTION_SERVICES.includes(data.sessionType)) {
    return true;
  }
  // Studio sessions require valid date and time
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(data.date || "");
  const timeValid = /^\d{2}:\d{2}$/.test(data.time || "");
  return dateValid && timeValid;
}, {
  message: "Studio sessions require valid date (YYYY-MM-DD) and time (HH:MM)",
});

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Supabase client with service role for database operations
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// PayPal API credentials for webhook validation
const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID")!;
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET")!;
const PAYPAL_API_BASE = "https://api-m.paypal.com"; // Use sandbox URL for testing: https://api-m.sandbox.paypal.com

// Get PayPal access token for API calls
async function getPayPalAccessToken(): Promise<string> {
  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[PAYPAL] Failed to get access token:", error);
    throw new Error("Failed to authenticate with PayPal");
  }

  const data = await response.json();
  return data.access_token;
}

// Verify PayPal order by fetching order details from PayPal API
async function verifyPayPalOrder(orderId: string): Promise<{ verified: boolean; orderDetails: Record<string, unknown> | null }> {
  try {
    const accessToken = await getPayPalAccessToken();
    
    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`[PAYPAL] Order verification failed: ${response.status}`);
      return { verified: false, orderDetails: null };
    }

    const orderDetails = await response.json();
    
    // Verify the order status is COMPLETED or APPROVED
    const validStatuses = ["COMPLETED", "APPROVED"];
    if (!validStatuses.includes(orderDetails.status)) {
      console.error(`[PAYPAL] Invalid order status: ${orderDetails.status}`);
      return { verified: false, orderDetails };
    }

    console.log(`[PAYPAL] Order ${orderId} verified successfully. Status: ${orderDetails.status}`);
    return { verified: true, orderDetails };
  } catch (error) {
    console.error("[PAYPAL] Order verification error:", error);
    return { verified: false, orderDetails: null };
  }
}

interface BookingPayload {
  orderId: string;
  payerName: string;
  payerEmail: string;
  phone: string;
  sessionType: "with-engineer" | "without-engineer" | "mixing" | "mastering" | "analog-mastering" | "podcast";
  date: string;
  time: string;
  hours: number;
  totalAmount: number;
  message?: string;
  podcastMinutes?: number;
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
    attendeeEmail?: string; // Kept for interface compatibility but not used
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

  // NOTE: Attendees removed - Service accounts cannot invite attendees 
  // without Domain-Wide Delegation of Authority (not available for personal Gmail)
  // The client email is included in the event description instead

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

// Check calendar load to determine if we need extended delay
async function checkCalendarLoad(
  accessToken: string,
  patronCalendarId: string,
  studioCalendarId: string,
  daysToCheck: number = 14
): Promise<{ isOverloaded: boolean; avgHoursPerDay: number }> {
  const now = new Date();
  let currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  currentDate.setDate(currentDate.getDate() + 1);

  let totalWorkHours = 0;
  let workableDays = 0;

  for (let i = 0; i < daysToCheck; i++) {
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(currentDate);
    dayEnd.setHours(23, 59, 59, 999);

    const [patronEvents, studioEvents] = await Promise.all([
      getCalendarEvents(accessToken, patronCalendarId, dayStart.toISOString(), dayEnd.toISOString()),
      getCalendarEvents(accessToken, studioCalendarId, dayStart.toISOString(), dayEnd.toISOString()),
    ]);

    // Skip days blocked by patron (Claridge)
    if (!hasAllDayEvent(patronEvents, currentDate)) {
      workableDays++;

      // Calculate total hours of work scheduled on studio calendar
      for (const event of studioEvents) {
        if (event.start.dateTime && event.end.dateTime) {
          const start = new Date(event.start.dateTime);
          const end = new Date(event.end.dateTime);
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          totalWorkHours += hours;
        }
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  const avgHoursPerDay = workableDays > 0 ? totalWorkHours / workableDays : 0;
  const isOverloaded = avgHoursPerDay > 15;

  console.log(`[CALENDAR-LOAD] Checked ${daysToCheck} days: ${workableDays} workable days, ${totalWorkHours.toFixed(1)}h total, ${avgHoursPerDay.toFixed(1)}h/day avg, overloaded: ${isOverloaded}`);

  return { isOverloaded, avgHoursPerDay };
}

async function findAvailableSlots(
  accessToken: string,
  patronCalendarId: string,
  studioCalendarId: string,
  durationHours: number,
  count: number,
  maxDaysToCheck: number = 30
): Promise<Date[]> {
  const slots: Date[] = [];
  const now = new Date();
  let currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  currentDate.setDate(currentDate.getDate() + 1); // Start from tomorrow
  
  let daysChecked = 0;

  console.log(`[WORK-SESSIONS] Looking for ${count} slots of ${durationHours}h each (max ${maxDaysToCheck} days)`);

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
  sessionType: "mixing" | "mastering" | "analog-mastering" | "podcast",
  clientName: string,
  orderId: string,
  podcastMinutes?: number
): Promise<{ delayWeeks: number }> {
  console.log(`[WORK-SESSIONS] Scheduling internal work sessions for ${sessionType}`);

  // Check if calendar is overloaded in the next 2 weeks
  const { isOverloaded, avgHoursPerDay } = await checkCalendarLoad(
    accessToken,
    patronCalendarId,
    studioCalendarId,
    14 // Check 2 weeks
  );

  // If overloaded (>15h/day average), extend to 1 month (30 days)
  const maxDaysToCheck = isOverloaded ? 60 : 30;
  const delayWeeks = isOverloaded ? 4 : 2;

  if (isOverloaded) {
    console.log(`[WORK-SESSIONS] ⚠️ Calendar overloaded (${avgHoursPerDay.toFixed(1)}h/day avg). Extending delay to 1 month.`);
  }

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
  } else if (sessionType === "podcast") {
    // Podcast: duration based on audio length - roughly 1h per 10 min of audio
    const estimatedHours = Math.max(1, Math.ceil((podcastMinutes || 1) / 10));
    sessionsToSchedule = [
      { duration: estimatedHours, label: `PODCAST MIX (${podcastMinutes}min)` },
    ];
  }

  for (const session of sessionsToSchedule) {
    const slots = await findAvailableSlots(
      accessToken,
      patronCalendarId,
      studioCalendarId,
      session.duration,
      1,
      maxDaysToCheck
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

  return { delayWeeks };
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

// Generate Google Calendar URL for adding event
const generateGoogleCalendarUrl = (payload: BookingPayload): string => {
  const [year, month, day] = payload.date.split("-").map(Number);
  const [hour, minute] = payload.time.split(":").map(Number);
  
  // Create start and end dates
  const startDate = new Date(year, month - 1, day, hour, minute);
  const endDate = new Date(startDate.getTime() + payload.hours * 60 * 60 * 1000);
  
  // Format dates for Google Calendar (YYYYMMDDTHHmmss)
  const formatForGcal = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };
  
  let sessionLabel = "";
  if (payload.sessionType === "with-engineer") {
    sessionLabel = "Session avec ingénieur";
  } else if (payload.sessionType === "without-engineer") {
    sessionLabel = "Location studio";
  }
  
  const title = encodeURIComponent(`🎤 ${sessionLabel} - Make Music Studio`);
  const location = encodeURIComponent("Rue du Sceptre 22, 1050 Ixelles, Bruxelles");
  const details = encodeURIComponent(
    `Session au Make Music Studio\n\n` +
    `Type: ${sessionLabel}\n` +
    `Durée: ${payload.hours}h\n` +
    `Référence: ${payload.orderId}\n\n` +
    `📍 Adresse: Rue du Sceptre 22, 1050 Ixelles, Bruxelles\n` +
    `📞 Contact: +32 476 09 41 72\n` +
    `✉️ Email: prod.makemusic@gmail.com`
  );
  
  const dates = `${formatForGcal(startDate)}/${formatForGcal(endDate)}`;
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&location=${location}&details=${details}`;
};

const generateInvoiceHtml = (payload: BookingPayload, isCashPayment: boolean = false): string => {
  const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
  const invoiceDate = new Date().toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  let sessionLabel = "";
  let unitPrice = 0;
  
  if (payload.sessionType === "with-engineer") {
    sessionLabel = "Session avec ingénieur son";
    unitPrice = 45;
  } else if (payload.sessionType === "without-engineer") {
    sessionLabel = "Location sèche (autonomie)";
    unitPrice = 22;
  } else if (payload.sessionType === "mixing") {
    sessionLabel = "Service Mixage + Mastering";
    unitPrice = 200;
  } else if (payload.sessionType === "mastering") {
    sessionLabel = "Service Mastering";
    unitPrice = 60;
  } else if (payload.sessionType === "analog-mastering") {
    sessionLabel = "Service Mastering Analogique";
    unitPrice = 100;
  } else if (payload.sessionType === "podcast") {
    sessionLabel = "Service Mixage Podcast";
    unitPrice = 40; // per minute
  }

  const isHourlyService = ["with-engineer", "without-engineer"].includes(payload.sessionType);
  const isPodcast = payload.sessionType === "podcast";
  
  const quantity = isPodcast ? (payload.podcastMinutes || 1) : (isHourlyService ? payload.hours : 1);
  const quantityLabel = isPodcast ? `${quantity} min` : (isHourlyService ? `${quantity}h` : "1");
  const totalHT = payload.totalAmount;
  
  const paymentStatus = isCashPayment 
    ? `<span style="color: #fbbf24;">À payer le jour de la session: ${totalHT}€</span>` 
    : `<span style="color: #22c55e;">Payé: ${totalHT}€</span>`;

  return `
    <div style="background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 24px; margin-top: 20px;">
      <div style="border-bottom: 1px solid #27272a; padding-bottom: 16px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 style="margin: 0; color: #22d3ee; font-size: 20px;">FACTURE</h3>
            <p style="margin: 4px 0 0 0; color: #71717a; font-size: 12px;">N° ${invoiceNumber}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; color: #a1a1aa; font-size: 12px;">Date: ${invoiceDate}</p>
          </div>
        </div>
      </div>
      
      <div style="margin-bottom: 16px;">
        <p style="margin: 0 0 4px 0; color: #71717a; font-size: 12px;">Émetteur:</p>
        <p style="margin: 0; color: #fafafa; font-size: 14px; font-weight: 600;">Make Music Studio</p>
        <p style="margin: 2px 0; color: #a1a1aa; font-size: 12px;">Rue du Sceptre 22, 1050 Ixelles, Bruxelles</p>
        <p style="margin: 0; color: #a1a1aa; font-size: 12px;">prod.makemusic@gmail.com • +32 476 09 41 72</p>
      </div>
      
      <div style="margin-bottom: 16px;">
        <p style="margin: 0 0 4px 0; color: #71717a; font-size: 12px;">Client:</p>
        <p style="margin: 0; color: #fafafa; font-size: 14px; font-weight: 600;">${payload.payerName}</p>
        <p style="margin: 2px 0; color: #a1a1aa; font-size: 12px;">${payload.payerEmail}</p>
        ${payload.phone ? `<p style="margin: 0; color: #a1a1aa; font-size: 12px;">${payload.phone}</p>` : ''}
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <thead>
          <tr style="border-bottom: 1px solid #27272a;">
            <th style="text-align: left; padding: 8px 0; color: #71717a; font-size: 12px; font-weight: normal;">Description</th>
            <th style="text-align: center; padding: 8px 0; color: #71717a; font-size: 12px; font-weight: normal;">Qté</th>
            <th style="text-align: right; padding: 8px 0; color: #71717a; font-size: 12px; font-weight: normal;">P.U.</th>
            <th style="text-align: right; padding: 8px 0; color: #71717a; font-size: 12px; font-weight: normal;">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 12px 0; color: #fafafa; font-size: 14px;">${sessionLabel}</td>
            <td style="padding: 12px 0; color: #a1a1aa; font-size: 14px; text-align: center;">${quantityLabel}</td>
            <td style="padding: 12px 0; color: #a1a1aa; font-size: 14px; text-align: right;">${unitPrice}€</td>
            <td style="padding: 12px 0; color: #fafafa; font-size: 14px; text-align: right; font-weight: 600;">${totalHT}€</td>
          </tr>
        </tbody>
      </table>
      
      <div style="border-top: 1px solid #27272a; padding-top: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #71717a; font-size: 14px;">Total TTC</span>
          <span style="color: #fbbf24; font-size: 20px; font-weight: bold;">${totalHT}€</span>
        </div>
        <div style="margin-top: 8px; text-align: right;">
          ${paymentStatus}
        </div>
      </div>
      
      <p style="margin: 16px 0 0 0; color: #52525b; font-size: 11px; text-align: center;">
        Réf: ${payload.orderId}
      </p>
    </div>
  `;
};

const generateConfirmationEmail = (payload: BookingPayload, driveFolderLink?: string | null, delayWeeks: number = 2, isCashPayment: boolean = false): string => {
  const isPostProduction = ["mixing", "mastering", "analog-mastering", "podcast"].includes(payload.sessionType);
  const delayText = delayWeeks === 4 ? "environ 1 mois" : "environ 2 semaines";
  
  let sessionLabel = "";
  let contactInfo = "";
  
  if (payload.sessionType === "with-engineer") {
    sessionLabel = "Session avec ingénieur son";
    contactInfo = `<p style="margin: 0 0 10px 0;"><strong>Contact ingénieur :</strong> Un ingénieur vous contactera avant votre session.</p>`;
  } else if (payload.sessionType === "without-engineer") {
    sessionLabel = "Location sèche (autonomie)";
    contactInfo = `<p style="margin: 0 0 10px 0;"><strong>Contact studio :</strong> Vous recevrez les instructions d'accès par email.</p>`;
  } else if (payload.sessionType === "mixing") {
    sessionLabel = "Service Mixage + Mastering";
    contactInfo = `<p style="margin: 0 0 10px 0;"><strong>Délai :</strong> Votre mixage sera traité dans un délai de <strong>${delayText}</strong>.</p>
                   <p style="margin: 0 0 10px 0;">Dès que l'ingénieur aura terminé le travail, nous vous contacterons par email ou WhatsApp pour vous proposer des dates pour la session d'écoute au studio.</p>`;
  } else if (payload.sessionType === "mastering") {
    sessionLabel = "Service Mastering";
    contactInfo = `<p style="margin: 0 0 10px 0;"><strong>Délai :</strong> Votre mastering sera traité dans un délai de <strong>${delayText}</strong>.</p>
                   <p style="margin: 0 0 10px 0;">Dès que l'ingénieur aura terminé le travail, nous vous contacterons par email ou WhatsApp pour vous proposer des dates pour la session d'écoute au studio.</p>`;
  } else if (payload.sessionType === "analog-mastering") {
    sessionLabel = "Service Mastering Analogique";
    contactInfo = `<p style="margin: 0 0 10px 0;"><strong>Délai :</strong> Votre mastering analogique sera traité dans un délai de <strong>${delayText}</strong>.</p>
                   <p style="margin: 0 0 10px 0;">Dès que l'ingénieur aura terminé le travail, nous vous contacterons par email ou WhatsApp pour vous proposer des dates pour la session d'écoute au studio.</p>`;
  } else if (payload.sessionType === "podcast") {
    sessionLabel = "Service Mixage Podcast";
    contactInfo = `<p style="margin: 0 0 10px 0;"><strong>Délai :</strong> Votre mixage podcast sera traité dans un délai de <strong>${delayText}</strong>.</p>
                   <p style="margin: 0 0 10px 0;">Dès que l'ingénieur aura terminé le travail, nous vous contacterons par email ou WhatsApp pour vous envoyer les fichiers finalisés.</p>`;
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

  // Generate Google Calendar link for studio sessions
  const googleCalendarUrl = !isPostProduction ? generateGoogleCalendarUrl(payload) : '';
  
  const addToCalendarSection = !isPostProduction ? `
              <!-- Add to Google Calendar -->
              <tr>
                <td style="padding: 0 40px 30px 40px;">
                  <div style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 211, 238, 0.1)); border-radius: 12px; padding: 20px; border: 1px solid rgba(34, 197, 94, 0.3); text-align: center;">
                    <h4 style="margin: 0 0 12px 0; color: #fafafa; font-size: 16px;">📅 Ajouter à votre calendrier</h4>
                    <p style="margin: 0 0 16px 0; color: #a1a1aa; font-size: 14px;">
                      Ne manquez pas votre session ! Ajoutez-la directement à votre calendrier Google.
                    </p>
                    <a href="${googleCalendarUrl}" target="_blank" style="display: inline-block; background-color: #22c55e; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                      📅 Ajouter à Google Calendar
                    </a>
                  </div>
                </td>
              </tr>
  ` : '';

  // Payment status message based on cash payment
  const paymentStatusMessage = isCashPayment
    ? `<h2 style="margin: 0 0 8px 0; color: #fafafa; font-size: 22px;">Réservation confirmée !</h2>
       <p style="margin: 0; color: #fbbf24; font-size: 16px; font-weight: 600;">💰 Montant à payer le jour de la session : ${payload.totalAmount}€</p>`
    : `<h2 style="margin: 0 0 8px 0; color: #fafafa; font-size: 22px;">Paiement confirmé !</h2>
       <p style="margin: 0; color: #a1a1aa; font-size: 14px;">${isPostProduction ? "Votre commande est enregistrée" : "Votre session est réservée"}, ${payload.payerName}</p>`;

  // Payment amount label
  const paymentLabel = isCashPayment ? "Montant à payer" : "Montant payé";

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
                        <span style="color: #71717a; font-size: 14px;">${paymentLabel}</span><br>
                        <span style="color: ${isCashPayment ? '#fbbf24' : '#fbbf24'}; font-size: 20px; font-weight: bold;">${payload.totalAmount}€</span>
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
                        <span style="color: #71717a; font-size: 14px;">${paymentLabel}</span><br>
                        <span style="color: ${isCashPayment ? '#fbbf24' : '#fbbf24'}; font-size: 20px; font-weight: bold;">${payload.totalAmount}€</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
  `;

  // Generate invoice section
  const invoiceSection = `
              <!-- Invoice -->
              <tr>
                <td style="padding: 0 40px 30px 40px;">
                  ${generateInvoiceHtml(payload, isCashPayment)}
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
                    ${paymentStatusMessage}
                  </div>
                </td>
              </tr>

              ${bookingDetailsSection}

              ${addToCalendarSection}

              ${driveSection}

              ${invoiceSection}

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

              <tr>
                <td style="padding: 30px 40px; background-color: #09090b; border-radius: 0 0 16px 16px; text-align: center; border-top: 1px solid #1e1e21;">
                  <p style="margin: 0 0 10px 0; color: #71717a; font-size: 14px;">
                    ${isPostProduction ? "Merci pour votre confiance !" : "À très bientôt au studio !"}
                  </p>
                  <p style="margin: 0 0 8px 0; color: #a1a1aa; font-size: 13px;">
                    📍 Rue du Sceptre 22, 1050 Ixelles, Bruxelles
                  </p>
                  <p style="margin: 0; color: #52525b; font-size: 12px;">
                    Make Music Studio • +32 476 09 41 72 • prod.makemusic@gmail.com
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
    const rawBody = await req.json();
    
    // Validate input
    const parseResult = bookingPayloadSchema.safeParse(rawBody);
    if (!parseResult.success) {
      console.error("[VALIDATION] Invalid booking payload:", parseResult.error.errors);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid booking data",
          details: parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const payload = parseResult.data;
    
    console.log("=== PAYMENT WEBHOOK RECEIVED ===");
    console.log("Order ID:", payload.orderId);
    console.log("Client:", payload.payerName.substring(0, 30));
    console.log("Email:", payload.payerEmail);
    console.log("Phone:", payload.phone);
    console.log("Session Type:", payload.sessionType);
    console.log("Date:", payload.date);
    console.log("Time:", payload.time);
    console.log("Duration:", payload.hours, "hours");
    console.log("Total Amount:", payload.totalAmount, "€");
    console.log("Message:", payload.message ? payload.message.substring(0, 100) : "N/A");

    // SECURITY: Verify the PayPal order is legitimate (skip for cash payments)
    const isCashPayment = payload.isCashPayment || payload.orderId.startsWith("CASH-");
    
    if (!isCashPayment) {
      console.log("[SECURITY] Verifying PayPal order...");
      const { verified, orderDetails } = await verifyPayPalOrder(payload.orderId);
      
      if (!verified) {
        console.error("[SECURITY] PayPal order verification FAILED - rejecting request");
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Payment verification failed. Order could not be verified with PayPal." 
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      console.log("[SECURITY] PayPal order verified successfully");
    } else {
      console.log("[CASH PAYMENT] Skipping PayPal verification - cash payment at studio");
    }

    const isPostProduction = ["mixing", "mastering", "analog-mastering", "podcast"].includes(payload.sessionType);
    
    let sessionLabel = "";
    if (payload.sessionType === "with-engineer") sessionLabel = "AVEC INGÉNIEUR";
    else if (payload.sessionType === "without-engineer") sessionLabel = "LOCATION SÈCHE";
    else if (payload.sessionType === "mixing") sessionLabel = "MIXAGE + MASTERING";
    else if (payload.sessionType === "mastering") sessionLabel = "MASTERING";
    else if (payload.sessionType === "analog-mastering") sessionLabel = "MASTERING ANALOGIQUE";
    else if (payload.sessionType === "podcast") sessionLabel = "MIXAGE PODCAST";

    // Get Google Calendar credentials
    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    const studioCalendarId = Deno.env.get("GOOGLE_STUDIO_CALENDAR_ID");
    const patronCalendarId = Deno.env.get("GOOGLE_PATRON_CALENDAR_ID");

    // ACTION 1: Handle calendar events based on session type
    let actualDelayWeeks = 2; // Default 2 weeks delay for post-production
    
    if (serviceAccountKey && studioCalendarId) {
      try {
        const calendarToken = await getAccessToken(serviceAccountKey, ["https://www.googleapis.com/auth/calendar"]);
        
        if (isPostProduction) {
          // For post-production: schedule internal work sessions
          console.log("[CALENDAR] Scheduling internal work sessions for post-production");
          
          if (patronCalendarId) {
            const result = await scheduleInternalWorkSessions(
              calendarToken,
              studioCalendarId,
              patronCalendarId,
              studioCalendarId,
              payload.sessionType as "mixing" | "mastering" | "analog-mastering" | "podcast",
              payload.payerName,
              payload.orderId,
              payload.podcastMinutes
            );
            actualDelayWeeks = result.delayWeeks;
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
      const emailHtml = generateConfirmationEmail(payload, driveFolderLink, actualDelayWeeks, isCashPayment);
      
      // Adapt email subject based on service type
      let emailSubject = "";
      if (isPostProduction) {
        emailSubject = `✅ Commande confirmée - ${sessionLabel}`;
      } else {
        emailSubject = `✅ Réservation confirmée - ${formatDate(payload.date)} à ${payload.time}`;
      }
      
      const emailResponse = await resend.emails.send({
        from: "Make Music Studio <onboarding@resend.dev>",
        reply_to: "prod.makemusic@gmail.com",
        to: [payload.payerEmail],
        subject: emailSubject,
        html: emailHtml,
      });

      console.log("[EMAIL] Confirmation email sent successfully:", emailResponse);

      // Send notification email to admin (romain.scheyvaerts@gmail.com because Resend test mode)
      console.log("[EMAIL] Sending notification to admin...");
      const paymentStatusAdmin = isCashPayment ? "💰 À payer au studio" : "✅ Payé";
      const adminEmailResponse = await resend.emails.send({
        from: "Make Music Studio <onboarding@resend.dev>",
        reply_to: "prod.makemusic@gmail.com",
        to: ["romain.scheyvaerts@gmail.com"],
        subject: `🎵 Nouvelle réservation - ${payload.payerName} - ${sessionLabel}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a1a; color: #fafafa;">
            <h2 style="color: #22d3ee; margin-bottom: 20px;">Nouvelle réservation reçue</h2>
            
            <div style="background: #262626; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
              <h3 style="color: #fafafa; margin-top: 0;">👤 Client</h3>
              <p><strong>Nom :</strong> ${payload.payerName}</p>
              <p><strong>Email :</strong> <a href="mailto:${payload.payerEmail}" style="color: #22d3ee;">${payload.payerEmail}</a></p>
              ${payload.phone ? `<p><strong>Téléphone :</strong> ${payload.phone}</p>` : ''}
            </div>

            <div style="background: #262626; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
              <h3 style="color: #fafafa; margin-top: 0;">📅 Session</h3>
              <p><strong>Type :</strong> ${sessionLabel}</p>
              ${!isPostProduction ? `<p><strong>Date :</strong> ${formatDate(payload.date)}</p>` : ''}
              ${!isPostProduction ? `<p><strong>Heure :</strong> ${payload.time}</p>` : ''}
              ${!isPostProduction ? `<p><strong>Durée :</strong> ${payload.hours}h</p>` : ''}
              ${payload.podcastMinutes ? `<p><strong>Durée audio :</strong> ${payload.podcastMinutes} min</p>` : ''}
            </div>

            <div style="background: ${isCashPayment ? '#fbbf24' : '#22d3ee'}; color: #1a1a1a; padding: 20px; border-radius: 8px; text-align: center;">
              <h3 style="margin: 0 0 10px 0;">${paymentStatusAdmin}</h3>
              <p style="font-size: 28px; font-weight: bold; margin: 0;">${payload.totalAmount}€</p>
              ${isCashPayment ? '<p style="margin: 10px 0 0 0; font-size: 14px;">Paiement en espèces le jour de la session</p>' : ''}
            </div>

            ${payload.message ? `<div style="background: #262626; padding: 15px; border-radius: 8px; margin-top: 15px;"><strong>Message :</strong> ${payload.message}</div>` : ''}

            <p style="margin-top: 20px; color: #a1a1aa; font-size: 12px; text-align: center;">
              Réf: ${payload.orderId}
            </p>
          </div>
        `,
      });
      console.log("[EMAIL] Admin notification sent:", adminEmailResponse);
    } catch (emailError) {
      console.error("[EMAIL] Failed to send email:", emailError);
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
