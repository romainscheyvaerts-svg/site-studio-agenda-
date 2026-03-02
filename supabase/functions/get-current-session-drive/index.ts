import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Parent folder ID for all client folders (CLOUD CLIENT MAKE MUSIC)
const PARENT_FOLDER_ID = "1AXGpSHUP0OyY2tWvCk573xb--Dj2jvLh";
const PARENT_FOLDER_LINK = `https://drive.google.com/drive/folders/${PARENT_FOLDER_ID}`;

interface CalendarEvent {
  id?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  summary?: string;
  description?: string;
}

// Escape single quotes in Drive API query values
function escapeDriveQueryValue(value: string): string {
  return value.replace(/'/g, "\\'");
}

async function getAccessToken(serviceAccountKey: string): Promise<string> {
  const key = JSON.parse(serviceAccountKey);
  
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.readonly",
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

// Extract local hour from dateTime string
function extractLocalHour(dateTimeStr: string): number {
  const match = dateTimeStr.match(/T(\d{2}):/);
  return match ? parseInt(match[1], 10) : 0;
}

// Extract local date from dateTime string
function extractLocalDate(dateTimeStr: string): string {
  return dateTimeStr.split("T")[0];
}

// Find session subfolder by date
async function findSessionSubfolder(
  parentFolderId: string,
  sessionDate: string,
  accessToken: string
): Promise<string | undefined> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) {
      return undefined;
    }
    
    const escapedDate = escapeDriveQueryValue(sessionDate);
    const query = `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${escapedDate}' and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
    
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!response.ok) return undefined;
    
    const data = await response.json();
    if (data.files && data.files.length > 0) {
      return `https://drive.google.com/drive/folders/${data.files[0].id}`;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[GET-CURRENT-SESSION-DRIVE] Starting request");
    
    // Check if user is admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Check if user is admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    
    const userRoles = roles?.map(r => r.role) || [];
    const isAdmin = userRoles.includes("admin") || userRoles.includes("superadmin");
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Always return the parent folder link for admins
    const result: {
      parentFolderLink: string;
      hasCurrentSession: boolean;
      clientName?: string;
      clientEmail?: string;
      clientFolderLink?: string;
      sessionFolderLink?: string;
      sessionDate?: string;
    } = {
      parentFolderLink: PARENT_FOLDER_LINK,
      hasCurrentSession: false,
    };
    
    // Get Google Calendar configuration
    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    const studioCalendarId = Deno.env.get("GOOGLE_STUDIO_CALENDAR_ID");
    
    if (!serviceAccountKey || !studioCalendarId) {
      console.log("[GET-CURRENT-SESSION-DRIVE] Calendar not configured");
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const accessToken = await getAccessToken(serviceAccountKey);
    
    // Get current time in Brussels timezone
    const now = new Date();
    const brusselsFormatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Brussels",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    
    const parts = brusselsFormatter.formatToParts(now);
    const brusselsDate = `${parts.find(p => p.type === "year")?.value}-${parts.find(p => p.type === "month")?.value}-${parts.find(p => p.type === "day")?.value}`;
    const brusselsHour = parseInt(parts.find(p => p.type === "hour")?.value || "0", 10);
    
    console.log(`[GET-CURRENT-SESSION-DRIVE] Current Brussels time: ${brusselsDate} ${brusselsHour}:00`);
    
    // Fetch events around current time (today only)
    const startOfDay = new Date(`${brusselsDate}T00:00:00+01:00`);
    const endOfDay = new Date(`${brusselsDate}T23:59:59+01:00`);
    
    const calendarUrl = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(studioCalendarId)}/events`);
    calendarUrl.searchParams.set("timeMin", startOfDay.toISOString());
    calendarUrl.searchParams.set("timeMax", endOfDay.toISOString());
    calendarUrl.searchParams.set("singleEvents", "true");
    calendarUrl.searchParams.set("orderBy", "startTime");
    calendarUrl.searchParams.set("fields", "items(id,summary,description,start,end)");
    
    const calendarResponse = await fetch(calendarUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!calendarResponse.ok) {
      console.error("[GET-CURRENT-SESSION-DRIVE] Calendar API error");
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const calendarData = await calendarResponse.json();
    const events: CalendarEvent[] = calendarData.items || [];
    
    console.log(`[GET-CURRENT-SESSION-DRIVE] Found ${events.length} events today`);
    
    // Find current session
    for (const event of events) {
      if (!event.start.dateTime || !event.end.dateTime) continue;
      
      const eventStartDate = extractLocalDate(event.start.dateTime);
      const eventEndDate = extractLocalDate(event.end.dateTime);
      const eventStartHour = extractLocalHour(event.start.dateTime);
      const eventEndHour = extractLocalHour(event.end.dateTime);
      
      // Check if current hour is within this event
      const isCurrentSession = 
        eventStartDate === brusselsDate &&
        brusselsHour >= eventStartHour &&
        (eventEndDate > brusselsDate || brusselsHour < eventEndHour);
      
      if (isCurrentSession) {
        console.log(`[GET-CURRENT-SESSION-DRIVE] Current session found: ${event.summary}`);
        
        // Extract client email from event
        let clientEmail: string | undefined;
        const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
        const descriptionText = event.description || "";
        const summaryText = event.summary || "";
        
        const labeledMatch = descriptionText.match(/Email:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
        const anyDescMatch = descriptionText.match(emailRegex);
        const anySummaryMatch = summaryText.match(emailRegex);
        
        clientEmail = (labeledMatch?.[1] || anyDescMatch?.[1] || anySummaryMatch?.[1])?.toLowerCase();
        
        result.hasCurrentSession = true;
        result.clientName = event.summary;
        result.clientEmail = clientEmail;
        result.sessionDate = brusselsDate;
        
        // Get client's Drive folder from database
        if (clientEmail) {
          const { data: folderData } = await supabase
            .from("client_drive_folders")
            .select("drive_folder_id, drive_folder_link")
            .eq("client_email", clientEmail)
            .maybeSingle();
          
          if (folderData) {
            result.clientFolderLink = folderData.drive_folder_link;
            
            // Try to find session subfolder
            const sessionFolderLink = await findSessionSubfolder(
              folderData.drive_folder_id,
              brusselsDate,
              accessToken
            );
            
            if (sessionFolderLink) {
              result.sessionFolderLink = sessionFolderLink;
            }
          }
        }
        
        break;
      }
    }
    
    console.log("[GET-CURRENT-SESSION-DRIVE] Result:", result);
    
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("[GET-CURRENT-SESSION-DRIVE] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
