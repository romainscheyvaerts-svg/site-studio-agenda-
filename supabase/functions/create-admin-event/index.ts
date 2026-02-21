import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
  
  if (error) {
    console.error("[ADMIN] Error checking admin role:", error);
    return false;
  }
  
  return data && data.length > 0;
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
    console.error("Token response:", tokenData);
    throw new Error("Failed to get access token");
  }
  
  return tokenData.access_token;
}

// Create calendar event with color
async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: {
    summary: string;
    description: string;
    start: string;
    end: string;
    colorId?: string;
  }
): Promise<{ id: string; htmlLink: string }> {
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
        { method: "popup", minutes: 1440 }, // 24 hours before
        { method: "popup", minutes: 180 },  // 3 hours before
      ],
    },
  };

  // Add color if specified
  if (event.colorId) {
    eventBody.colorId = event.colorId;
  }

  console.log(`[ADMIN-EVENT] Creating event: ${event.summary}`);

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
    console.error(`[ADMIN-EVENT] Error creating event:`, errorText);
    throw new Error(`Failed to create calendar event: ${response.status}`);
  }

  const createdEvent = await response.json();
  console.log(`[ADMIN-EVENT] Event created successfully: ${createdEvent.id}`);
  
  return {
    id: createdEvent.id,
    htmlLink: createdEvent.htmlLink,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user is admin
    // Try both lowercase and uppercase Authorization header
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    console.log("[CREATE-ADMIN-EVENT] Auth header present:", !!authHeader);

    if (!authHeader) {
      console.log("[CREATE-ADMIN-EVENT] No auth header found");
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("[CREATE-ADMIN-EVENT] Token length:", token.length);

    // Try to validate the token with service role key
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    
    console.log("[CREATE-ADMIN-EVENT] Auth result - user:", userData?.user?.email, "error:", authError?.message);

    if (authError || !userData?.user) {
      console.log("[CREATE-ADMIN-EVENT] Auth failed:", authError?.message || "No user");
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          details: authError?.message || "User not found",
          hint: "Make sure you are logged in with a valid session",
          tokenLength: token.length
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = userData.user;
    console.log("[CREATE-ADMIN-EVENT] User authenticated:", user.email, user.id);

    // Check if user is admin via database role check
    const hasAdminRole = await isUserAdmin(user.id);
    if (!hasAdminRole) {
      console.log("[ADMIN-EVENT] User lacks admin role:", user.email);
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { title, clientName, clientEmail, description, date, time, hours, colorId, assignedAdminId, serviceType, totalPrice } = body;

    // The admin who creates the event is automatically the responsible person
    // Use assignedAdminId if provided, otherwise default to the creator (user.id)
    const responsibleAdminId = assignedAdminId || user.id;

    console.log("[ADMIN-EVENT] Creating event:", { title, clientName, date, time, hours, colorId, responsibleAdminId, createdBy: user.id });

    // Validate required fields
    if (!title || !date || !time) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: title, date, time" }),
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

    // Parse date and time
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    
    // Helper function to format datetime for Google Calendar (preserves local time in Europe/Brussels)
    // Don't use toISOString() as it converts to UTC, causing timezone shift
    const pad = (n: number) => n.toString().padStart(2, '0');
    const formatForCalendar = (y: number, m: number, d: number, h: number, min: number): string => {
      return `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:00+01:00`;
    };
    
    const startFormatted = formatForCalendar(year, month, day, hour, minute || 0);
    const endHour = hour + (hours || 2);
    const endFormatted = formatForCalendar(year, month, day, endHour, minute || 0);
    
    console.log("[ADMIN-EVENT] Formatted times:", { start: startFormatted, end: endFormatted });

    // Build event summary with client name if provided
    let eventSummary = title;
    if (clientName) {
      eventSummary = `${title} - ${clientName}`;
    }

    // Build description with client email for accounting tracking
    const eventDescription = [
      clientName ? `Client: ${clientName}` : null,
      clientEmail ? `Email: ${clientEmail}` : null,
      `Durée: ${hours || 2}h`,
      `Créé par: Admin`,
      description ? `\nNotes: ${description}` : null,
    ].filter(Boolean).join('\n');

    // Create the event
    const createdEvent = await createCalendarEvent(accessToken, studioCalendarId, {
      summary: eventSummary,
      description: eventDescription,
      start: startFormatted,
      end: endFormatted,
      colorId: colorId || undefined,
    });

    // Save the session assignment in database
    // The creator is automatically the responsible admin
    const sessionData: Record<string, unknown> = {
      event_id: createdEvent.id,
      created_by: user.id,
      assigned_to: responsibleAdminId,
      updated_at: new Date().toISOString(),
    };
    
    // Add service type and total price if provided
    if (serviceType) {
      sessionData.service_type = serviceType;
    }
    if (totalPrice !== undefined && totalPrice !== null) {
      sessionData.total_price = totalPrice;
    }
    if (clientName) {
      sessionData.client_name = clientName;
    }
    
    console.log("[ADMIN-EVENT] Saving session data:", sessionData);
    
    const { error: assignmentError } = await supabase
      .from("session_assignments")
      .upsert(sessionData, {
        onConflict: "event_id"
      });

    if (assignmentError) {
      console.error("[ADMIN-EVENT] Error saving session assignment:", assignmentError);
      // Don't fail the whole request, event was created successfully
    } else {
      console.log(`[ADMIN-EVENT] Session assignment saved: created_by=${user.id}, assigned_to=${responsibleAdminId}`);
    }

    // Send notification email to assigned admin if specified (only if different from creator)
    let adminNotificationSent = false;
    if (assignedAdminId) {
      try {
        // Get admin profile with email
        const { data: adminProfile, error: profileError } = await supabase
          .from("admin_profiles")
          .select("display_name, email, user_id")
          .eq("user_id", assignedAdminId)
          .single();

        if (profileError) {
          console.error("[ADMIN-EVENT] Error fetching admin profile:", profileError);
        } else if (adminProfile) {
          // Get admin email from profile or auth.users
          let adminEmail = adminProfile.email;
          
          if (!adminEmail) {
            // Fallback: get email from auth.users
            const { data: authUser } = await supabase.auth.admin.getUserById(assignedAdminId);
            adminEmail = authUser?.user?.email;
          }

          if (adminEmail) {
            // Get email template
            const { data: template } = await supabase
              .from("email_templates")
              .select("*")
              .eq("template_key", "admin_session_assignment")
              .eq("is_active", true)
              .single();

            if (template) {
              // Format date for display
              const dateObj = new Date(year, month - 1, day);
              const options: Intl.DateTimeFormatOptions = { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              };
              const formattedDate = dateObj.toLocaleDateString('fr-BE', options);
              const startTimeStr = `${hour.toString().padStart(2, '0')}:${(minute || 0).toString().padStart(2, '0')}`;
              const endHourEmail = hour + (hours || 2);
              const endTimeStr = `${endHourEmail.toString().padStart(2, '0')}:00`;

              // Generate Google Calendar add link (use simple format)
              const startIso = `${year}${pad(month)}${pad(day)}T${pad(hour)}${pad(minute || 0)}00`;
              const endIso = `${year}${pad(month)}${pad(day)}T${pad(endHourEmail)}${pad(minute || 0)}00`;
              const calendarAddUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventSummary)}&dates=${startIso}/${endIso}&details=${encodeURIComponent(eventDescription)}&location=Make%20Music%20Studio`;

              // Replace template variables
              const replaceVars = (text: string | null) => {
                if (!text) return '';
                return text
                  .replace(/\{\{admin_name\}\}/g, adminProfile.display_name || 'Admin')
                  .replace(/\{\{session_date\}\}/g, formattedDate)
                  .replace(/\{\{start_time\}\}/g, startTimeStr)
                  .replace(/\{\{end_time\}\}/g, endTimeStr)
                  .replace(/\{\{duration\}\}/g, String(hours || 2))
                  .replace(/\{\{session_title\}\}/g, eventSummary)
                  .replace(/\{\{client_name\}\}/g, clientName || '')
                  .replace(/\{\{notes\}\}/g, description || '')
                  .replace(/\{\{calendar_add_url\}\}/g, calendarAddUrl)
                  .replace(/\{\{#if client_name\}\}([\s\S]*?)\{\{\/if\}\}/g, clientName ? '$1' : '')
                  .replace(/\{\{#if notes\}\}([\s\S]*?)\{\{\/if\}\}/g, description ? '$1' : '');
              };

              const subject = replaceVars(template.subject_template);
              const heading = replaceVars(template.heading_text);
              const subheading = replaceVars(template.subheading_text);
              const bodyContent = replaceVars(template.body_template);
              const ctaText = template.cta_button_text;

              // Build HTML email
              const htmlEmail = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:Arial,sans-serif;">
  <div style="max-width:500px;margin:40px auto;background-color:#1a1a1a;border-radius:12px;border:1px solid #262626;overflow:hidden;">
    <div style="background:linear-gradient(135deg, rgba(16,185,129,0.2), rgba(34,211,238,0.2));padding:20px;text-align:center;border-bottom:1px solid #262626;">
      ${template.show_logo ? '<img src="https://www.studiomakemusic.com/favicon.png" alt="Logo" style="width:50px;height:50px;margin:0 auto 10px;border-radius:8px;display:block;" />' : ''}
      <h1 style="color:#ffffff;font-size:18px;font-weight:bold;margin:0;">Make Music Studio</h1>
    </div>
    <div style="padding:24px;">
      ${heading ? `<h2 style="color:#ffffff;font-size:20px;margin:0 0 8px;">${heading}</h2>` : ''}
      ${subheading ? `<p style="color:#a1a1aa;font-size:14px;margin:0 0 20px;">${subheading}</p>` : ''}
      <div style="color:#d4d4d8;font-size:14px;line-height:1.7;white-space:pre-wrap;">${bodyContent}</div>
      ${template.show_session_details ? `
        <div style="background-color:#0a0a0a;border-radius:8px;padding:16px;margin-top:20px;border:1px solid #262626;">
          <p style="color:#10b981;font-size:12px;margin:0 0 8px;text-transform:uppercase;">📅 Détails de la session</p>
          <p style="color:#ffffff;font-size:14px;margin:0;"><strong>${formattedDate}</strong></p>
          <p style="color:#a1a1aa;font-size:13px;margin:4px 0 0;">${startTimeStr} - ${endTimeStr} (${hours || 2}h)</p>
        </div>
      ` : ''}
      ${ctaText && template.show_calendar_button ? `
        <div style="margin-top:24px;text-align:center;">
          <a href="${calendarAddUrl}" target="_blank" style="display:inline-block;background-color:#10b981;color:#0a0a0a;padding:12px 24px;border-radius:8px;font-weight:bold;font-size:14px;text-decoration:none;">${ctaText}</a>
        </div>
      ` : ''}
    </div>
    <div style="background-color:#0a0a0a;padding:16px;border-top:1px solid #262626;text-align:center;">
      <p style="color:#71717a;font-size:11px;margin:0;">${template.footer_text || "Make Music Studio - Studio d'enregistrement à Bruxelles"}</p>
    </div>
  </div>
</body>
</html>`;

              // Send email via Resend
              const resendApiKey = Deno.env.get("RESEND_API_KEY");
              if (resendApiKey) {
                const resendResponse = await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${resendApiKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    from: "Make Music Studio <noreply@studiomakemusic.com>",
                    to: [adminEmail],
                    subject: subject,
                    html: htmlEmail,
                  }),
                });

                if (resendResponse.ok) {
                  console.log(`[ADMIN-EVENT] Notification email sent to ${adminEmail}`);
                  adminNotificationSent = true;
                } else {
                  const resendError = await resendResponse.text();
                  console.error("[ADMIN-EVENT] Failed to send notification email:", resendError);
                }
              } else {
                console.log("[ADMIN-EVENT] RESEND_API_KEY not configured, skipping email");
              }
            } else {
              console.log("[ADMIN-EVENT] admin_session_assignment template not found or inactive");
            }
          } else {
            console.log("[ADMIN-EVENT] No email found for admin:", assignedAdminId);
          }
        }
      } catch (emailError) {
        console.error("[ADMIN-EVENT] Error sending admin notification:", emailError);
        // Don't fail the whole request if email fails
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        eventId: createdEvent.id,
        eventLink: createdEvent.htmlLink,
        adminNotificationSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[ADMIN-EVENT] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorStack,
        hint: "Check Edge Function logs in Supabase Dashboard"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
