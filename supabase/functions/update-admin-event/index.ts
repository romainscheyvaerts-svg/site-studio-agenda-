import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Check if user has admin or superadmin role in database
async function isUserAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "superadmin"]);

  if (error) return false;
  return data && data.length > 0;
}

// Get admin email from auth.users
async function getAdminEmail(userId: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) {
    console.log("[UPDATE-ADMIN-EVENT] Could not get admin email:", error);
    return null;
  }
  return data.user.email;
}

// Get admin display name from admin_profiles
async function getAdminDisplayName(userId: string): Promise<string> {
  const { data } = await supabase
    .from("admin_profiles")
    .select("display_name")
    .eq("user_id", userId)
    .single();
  return data?.display_name || "Admin";
}

// Send notification email to assigned admin
async function sendAdminNotificationEmail(
  adminEmail: string,
  adminName: string,
  sessionTitle: string,
  sessionDate: string,
  sessionStartTime: string,
  sessionEndTime: string,
  clientName?: string
): Promise<void> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.log("[UPDATE-ADMIN-EVENT] No Resend API key, skipping email notification");
    return;
  }

  const formattedDate = new Date(sessionDate).toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a; color: #ffffff; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 32px; border: 1px solid #00d9ff33; }
        .header { text-align: center; margin-bottom: 24px; }
        .logo { font-size: 28px; font-weight: bold; color: #00d9ff; margin-bottom: 8px; }
        .title { font-size: 20px; color: #ffffff; margin-bottom: 4px; }
        .session-card { background: rgba(0, 217, 255, 0.1); border: 1px solid #00d9ff50; border-radius: 12px; padding: 20px; margin: 20px 0; }
        .session-title { font-size: 18px; font-weight: bold; color: #00d9ff; margin-bottom: 12px; }
        .detail-row { display: flex; align-items: center; margin: 8px 0; color: #e0e0e0; }
        .detail-label { font-weight: 500; color: #999; width: 80px; }
        .detail-value { color: #ffffff; }
        .highlight { background: rgba(0, 217, 255, 0.2); padding: 2px 8px; border-radius: 4px; color: #00d9ff; font-weight: 600; }
        .footer { text-align: center; margin-top: 24px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🎵 MAKE MUSIC STUDIO</div>
          <div class="title">Nouvelle session assignée</div>
        </div>
        
        <p style="color: #e0e0e0;">Bonjour <strong style="color: #00d9ff;">${adminName}</strong>,</p>
        
        <p style="color: #e0e0e0;">Tu as été désigné(e) comme responsable pour la session suivante :</p>
        
        <div class="session-card">
          <div class="session-title">📅 ${sessionTitle}</div>
          <div class="detail-row">
            <span class="detail-label">📆 Date:</span>
            <span class="detail-value">${formattedDate}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">🕐 Horaire:</span>
            <span class="detail-value"><span class="highlight">${sessionStartTime} - ${sessionEndTime}</span></span>
          </div>
          ${clientName ? `
          <div class="detail-row">
            <span class="detail-label">👤 Client:</span>
            <span class="detail-value">${clientName}</span>
          </div>
          ` : ""}
        </div>
        
        <p style="color: #e0e0e0;">Merci de te rendre disponible et de t'assurer que tout est prêt pour cette session ! 🎤</p>
        
        <div class="footer">
          <p>Cet email a été envoyé automatiquement par le système de gestion MAKE MUSIC Studio.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "MAKE MUSIC Studio <no-reply@studiomakemusic.com>",
        to: [adminEmail],
        subject: `🎵 Session assignée: ${sessionTitle} - ${formattedDate}`,
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[UPDATE-ADMIN-EVENT] Failed to send notification email:", errorText);
    } else {
      console.log(`[UPDATE-ADMIN-EVENT] Notification email sent to ${adminEmail}`);
    }
  } catch (err) {
    console.error("[UPDATE-ADMIN-EVENT] Error sending notification email:", err);
  }
}

// Get OAuth2 access token for Google APIs
async function getAccessToken(serviceAccountKey: string, scopes: string[]): Promise<string> {
  const key = JSON.parse(serviceAccountKey);

  const header = { alg: "RS256", typ: "JWT" };
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
    throw new Error("Failed to get access token");
  }

  return tokenData.access_token;
}

// Update calendar event
async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  updates: {
    summary?: string;
    start?: string;
    end?: string;
    colorId?: string;
  }
): Promise<{ id: string; htmlLink: string }> {
  // First, get the existing event
  const getUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

  const getResponse = await fetch(getUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!getResponse.ok) {
    throw new Error(`Failed to get calendar event: ${getResponse.status}`);
  }

  const existingEvent = await getResponse.json();

  // Prepare updated event
  const updatedEvent: Record<string, unknown> = {
    ...existingEvent,
  };

  if (updates.summary) {
    updatedEvent.summary = updates.summary;
  }

  if (updates.start) {
    updatedEvent.start = {
      dateTime: updates.start,
      timeZone: "Europe/Brussels",
    };
  }

  if (updates.end) {
    updatedEvent.end = {
      dateTime: updates.end,
      timeZone: "Europe/Brussels",
    };
  }

  if (updates.colorId) {
    updatedEvent.colorId = updates.colorId;
  }

  const updateUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

  const response = await fetch(updateUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatedEvent),
  });

  if (!response.ok) {
    throw new Error(`Failed to update calendar event: ${response.status}`);
  }

  const result = await response.json();

  return {
    id: result.id,
    htmlLink: result.htmlLink,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // SÉCURITÉ: Vérifier le token avec supabase.auth.getUser() au lieu de décodage manuel
    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;

    // Check if user is admin via database role check
    const hasAdminRole = await isUserAdmin(userId);
    if (!hasAdminRole) {
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { eventId, title, date, startTime, endTime, colorId, assignedAdminId, serviceType, totalPrice, clientName, notes } = body;

    console.log("[UPDATE-ADMIN-EVENT] Request:", { eventId, title, date, startTime, endTime, assignedAdminId, serviceType, totalPrice });

    // Validate required fields
    if (!eventId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: eventId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Google Calendar credentials
    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    const studioCalendarId = Deno.env.get("GOOGLE_STUDIO_CALENDAR_ID");

    if (!serviceAccountKey || !studioCalendarId) {
      return new Response(
        JSON.stringify({ error: "Calendar configuration missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get access token
    const accessToken = await getAccessToken(serviceAccountKey, ["https://www.googleapis.com/auth/calendar"]);

    // Build update object
    const updates: {
      summary?: string;
      start?: string;
      end?: string;
      colorId?: string;
    } = {};

    if (title) {
      updates.summary = title;
    }

    // Helper function to format datetime for Google Calendar (preserves local time in Europe/Brussels)
    const formatDateTimeForCalendar = (dateStr: string, timeStr: string): string => {
      const [year, month, day] = dateStr.split("-").map(Number);
      const [hour, minute] = timeStr.split(":").map(Number);
      
      // Format as ISO 8601 with Brussels timezone offset
      // Don't use toISOString() as it converts to UTC
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute || 0)}:00+01:00`;
    };

    if (date && startTime) {
      updates.start = formatDateTimeForCalendar(date, startTime);
      console.log("[UPDATE-ADMIN-EVENT] Formatted start time:", updates.start);
    }

    if (date && endTime) {
      updates.end = formatDateTimeForCalendar(date, endTime);
      console.log("[UPDATE-ADMIN-EVENT] Formatted end time:", updates.end);
    }

    if (colorId) {
      updates.colorId = colorId;
    }

    // Update the event
    const updatedEvent = await updateCalendarEvent(accessToken, studioCalendarId, eventId, updates);

    // Update session assignment with all details
    // Always upsert if any of these fields are provided
    const hasSessionData = assignedAdminId || serviceType || totalPrice !== undefined || clientName || notes;
    
    // Get previous assignment to check if admin changed
    let previousAssignedTo: string | null = null;
    if (assignedAdminId) {
      const { data: existingAssignment } = await supabase
        .from("session_assignments")
        .select("assigned_to")
        .eq("event_id", eventId)
        .single();
      
      previousAssignedTo = existingAssignment?.assigned_to || null;
    }
    
    if (hasSessionData) {
      const sessionData: Record<string, unknown> = {
        event_id: eventId,
        updated_at: new Date().toISOString(),
      };
      
      if (assignedAdminId) {
        sessionData.assigned_to = assignedAdminId;
      }
      if (serviceType !== undefined) {
        sessionData.service_type = serviceType;
      }
      if (totalPrice !== undefined) {
        sessionData.total_price = totalPrice;
      }
      if (clientName !== undefined) {
        sessionData.client_name = clientName;
      }
      if (notes !== undefined) {
        sessionData.notes = notes;
      }

      const { error: assignmentError } = await supabase
        .from("session_assignments")
        .upsert(sessionData, {
          onConflict: "event_id"
        });

      if (assignmentError) {
        console.error("[UPDATE-ADMIN-EVENT] Error saving session data:", assignmentError);
        // Don't fail the whole request, event was updated successfully
      } else {
        console.log(`[UPDATE-ADMIN-EVENT] Session data updated:`, sessionData);
      }
      
      // Send notification email if admin assignment changed
      if (assignedAdminId && assignedAdminId !== previousAssignedTo) {
        console.log(`[UPDATE-ADMIN-EVENT] Admin changed from ${previousAssignedTo} to ${assignedAdminId}, sending notification...`);
        
        // Get admin email and display name
        const adminEmail = await getAdminEmail(assignedAdminId);
        const adminName = await getAdminDisplayName(assignedAdminId);
        
        if (adminEmail) {
          await sendAdminNotificationEmail(
            adminEmail,
            adminName,
            title || "Session studio",
            date || new Date().toISOString().split("T")[0],
            startTime || "09:00",
            endTime || "10:00",
            clientName
          );
        } else {
          console.log("[UPDATE-ADMIN-EVENT] Could not get admin email, skipping notification");
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        eventId: updatedEvent.id,
        eventLink: updatedEvent.htmlLink,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
