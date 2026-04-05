import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { renderEmailHtml, TemplateVariables } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Parent folder ID will be fetched from studio config in database

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[BOOKING-ACTION] ${step}${detailsStr}`);
};

// Get Google Drive access token
async function getDriveAccessToken(serviceAccountKey: string): Promise<string> {
  const key = JSON.parse(serviceAccountKey);
  const now = Math.floor(Date.now() / 1000);
  
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signatureInput = `${headerB64}.${payloadB64}`;

  const keyData = key.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signatureInput)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const jwt = `${headerB64}.${payloadB64}.${signatureB64}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// Create client folder and session subfolder in Google Drive
async function createClientDriveFolder(
  supabaseClient: any,
  accessToken: string,
  booking: any,
  parentFolderId: string
): Promise<{ clientFolderLink: string; subfolderLink: string } | null> {
  try {
    const clientEmailRaw = booking.client_email;
    const clientEmail = (clientEmailRaw || "").toLowerCase().trim();
    const clientName = booking.client_name;
    const sessionDate = booking.session_date;

    // Check if client already has a folder (email normalized)
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
            parents: [parentFolderId],
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
      // Create new client folder
      logStep("Creating new client folder for", { clientName, clientEmail });
      
      const createFolderResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: clientEmail, // Use email as folder name to avoid duplicates (case sensitivity)
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentFolderId],
        }),
      });

      const newFolder = await createFolderResponse.json();
      if (!createFolderResponse.ok) {
        logStep("Failed to create client folder", { error: newFolder });
        return null;
      }

      clientFolderId = newFolder.id;
      clientFolderLink = `https://drive.google.com/drive/folders/${newFolder.id}`;

      // Set folder permissions (anyone with link can edit)
      await fetch(`https://www.googleapis.com/drive/v3/files/${newFolder.id}/permissions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "writer",
          type: "anyone",
        }),
      });

      // Save to database
      await supabaseClient.from("client_drive_folders").insert({
        client_email: clientEmail,
        client_name: clientName || clientEmail,
        drive_folder_id: newFolder.id,
        drive_folder_link: clientFolderLink,
      });

      logStep("Client folder created", { clientFolderLink });
    }

    // Create subfolder with session date
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

    // Set subfolder permissions
    await fetch(`https://www.googleapis.com/drive/v3/files/${subfolder.id}/permissions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "writer",
        type: "anyone",
      }),
    });

    const subfolderLink = `https://drive.google.com/drive/folders/${subfolder.id}`;
    logStep("Session subfolder created", { subfolderLink });

    return { clientFolderLink, subfolderLink };
  } catch (error) {
    logStep("Error creating Drive folder", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

// Get Google Calendar access token
async function getAccessToken(serviceAccountKey: string): Promise<string> {
  const key = JSON.parse(serviceAccountKey);
  const now = Math.floor(Date.now() / 1000);
  
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signatureInput = `${headerB64}.${payloadB64}`;

  const keyData = key.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signatureInput)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const jwt = `${headerB64}.${payloadB64}.${signatureB64}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// Add event to Google Calendar
async function addToGoogleCalendar(
  accessToken: string,
  calendarId: string,
  booking: any
): Promise<string | null> {
  const sessionDate = booking.session_date;
  const startTime = booking.start_time;
  const endTime = booking.end_time;
  
  // Format time correctly - if already has seconds, don't add more
  const formatTime = (time: string) => {
    if (!time) return "00:00:00";
    if (/^\d{2}:\d{2}$/.test(time)) return `${time}:00`;
    if (/^\d{2}:\d{2}:\d{2}$/.test(time)) return time;
    return `${time}:00`;
  };
  
  const startDateTime = `${sessionDate}T${formatTime(startTime)}`;
  const endDateTime = `${sessionDate}T${formatTime(endTime)}`;
  
  const event = {
    summary: `${booking.client_name} — ${booking.session_type}`,
    description: `Client: ${booking.client_name}\nEmail: ${booking.client_email}\nTéléphone: ${booking.client_phone || 'Non fourni'}\nMontant: ${booking.amount_paid}€`,
    start: {
      dateTime: startDateTime,
      timeZone: 'Europe/Brussels'
    },
    end: {
      dateTime: endDateTime,
      timeZone: 'Europe/Brussels'
    }
  };
  
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    logStep("Failed to add to Google Calendar", { error: errorText });
    return null;
  }
  
  const createdEvent = await response.json();
  logStep("Event added to Google Calendar", { eventId: createdEvent.id });
  return createdEvent.id;
}

// Delete event from Google Calendar
async function deleteFromGoogleCalendar(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    );
    
    if (response.ok || response.status === 204) {
      logStep("Event deleted from Google Calendar", { eventId });
      return true;
    } else {
      const errorText = await response.text();
      logStep("Failed to delete from Google Calendar", { eventId, status: response.status, error: errorText });
      return false;
    }
  } catch (error) {
    logStep("Error deleting from Google Calendar", { eventId, error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

// Send confirmation email to client with Drive folder link
async function sendClientFinalConfirmation(resend: Resend, booking: any, driveLink?: string, clientRootDriveLink?: string): Promise<void> {
  const sessionDate = new Date(booking.session_date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Prepare template variables
  const templateVars: TemplateVariables = {
    client_name: booking.client_name,
    client_email: booking.client_email,
    session_date: sessionDate,
    start_time: booking.start_time,
    end_time: booking.end_time,
    service_type: booking.session_type,
    amount_paid: String(booking.amount_paid),
    drive_link: driveLink,
    client_root_drive_link: clientRootDriveLink,
  };

  // Try to use template from database
  const templateResult = await renderEmailHtml("booking_confirmed", templateVars);

  let subject: string;
  let html: string;

  if (templateResult) {
    subject = templateResult.subject;
    html = templateResult.html;
    logStep("Using database template for booking_confirmed");
  } else {
    // Fallback to hardcoded template
    logStep("Using fallback template for booking_confirmed");
    subject = `✓ Session confirmée - ${sessionDate}`;

    const driveSectionHtml = driveLink ? `
        <div style="background: linear-gradient(135deg, #4285F4 0%, #34A853 100%); border-radius: 8px; padding: 20px; margin-bottom: 20px; color: white;">
          <h4 style="margin: 0 0 12px 0; font-size: 16px;">📁 Votre dossier de session</h4>
          <p style="margin: 0 0 16px 0; opacity: 0.9; font-size: 14px;">
            Cliquez ci-dessous pour accéder à votre dossier Google Drive.<br>
            Vous pouvez y déposer vos fichiers (instrumentales, références, etc.) avant la session.
          </p>
          <a href="${driveLink}"
             target="_blank"
             style="display: inline-block; background-color: white; color: #4285F4; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            📂 Ouvrir mon dossier Drive
          </a>
        </div>
    ` : '';

    html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #16213e; padding: 30px; border-radius: 12px; color: #ffffff; text-align: center; margin-bottom: 20px;">
          <h1 style="margin: 0; color: #ffffff; font-size: 28px; line-height: 1.2;">Make Music Studio</h1>
          <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px; line-height: 1.4;">Votre session est confirmée !</p>
        </div>

        <div style="background-color: #ECFDF5; border: 1px solid #10B981; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
          <h2 style="color: #059669; margin: 0 0 8px 0;">✓ Réservation confirmée</h2>
          <p style="color: #047857; margin: 0;">Votre session au studio est validée</p>
        </div>

        <div style="background-color: #F8FAFC; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 16px 0; color: #1E293B;">Détails de votre session</h3>
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
          </table>
        </div>

        ${driveSectionHtml}

        <div style="background-color: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <h4 style="color: #92400E; margin: 0 0 8px 0;">📍 Adresse du studio</h4>
          <p style="color: #78350F; margin: 0;">
            Make Music Studio<br>
            Bruxelles<br>
            (L'adresse exacte vous sera communiquée par email séparé)
          </p>
        </div>

        <p style="color: #475569; line-height: 1.6;">
          À très bientôt au studio !<br><br>
          L'équipe Make Music
        </p>

        <p style="color: #64748B; font-size: 12px; text-align: center; margin-top: 30px;">
          Make Music Studio - Bruxelles
        </p>
      </body>
      </html>
    `;
  }

  await resend.emails.send({
    from: 'Make Music Studio <noreply@studiomakemusic.com>',
    to: [booking.client_email],
    subject,
    html
  });

  logStep("Final confirmation sent to client", { email: booking.client_email, hasDriveLink: !!driveLink });
}

// Send rejection/refund email to client
async function sendClientRejectionEmail(resend: Resend, booking: any): Promise<void> {
  const sessionDate = new Date(booking.session_date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Prepare template variables
  const templateVars: TemplateVariables = {
    client_name: booking.client_name,
    client_email: booking.client_email,
    session_date: sessionDate,
    start_time: booking.start_time,
    end_time: booking.end_time,
    service_type: booking.session_type,
    amount_paid: String(booking.amount_paid),
  };

  // Try to use template from database
  const templateResult = await renderEmailHtml("booking_rejected", templateVars);

  let subject: string;
  let html: string;

  if (templateResult) {
    subject = templateResult.subject;
    html = templateResult.html;
    logStep("Using database template for booking_rejected");
  } else {
    // Fallback to hardcoded template
    logStep("Using fallback template for booking_rejected");
    subject = `Information sur votre réservation - ${sessionDate}`;

    html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 12px; color: white; text-align: center; margin-bottom: 20px;">
          <h1 style="margin: 0;">Make Music Studio</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.8;">Information importante</p>
        </div>

        <div style="background-color: #FEF2F2; border: 1px solid #EF4444; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #DC2626; margin: 0 0 8px 0;">Session non disponible</h2>
          <p style="color: #7F1D1D; margin: 0;">
            Malheureusement, le créneau que vous avez réservé n'est plus disponible.
          </p>
        </div>

        <p style="color: #475569; line-height: 1.6;">
          Bonjour ${booking.client_name},<br><br>
          Nous sommes désolés de vous informer que votre session du <strong>${sessionDate}</strong>
          (${booking.start_time} - ${booking.end_time}) ne peut pas être confirmée.<br><br>
          <strong>Un remboursement complet de ${booking.amount_paid}€ sera effectué sous 5-10 jours ouvrables.</strong><br><br>
          Nous vous invitons à effectuer une nouvelle réservation sur notre site.<br><br>
          Nous nous excusons pour ce désagrément.
        </p>

        <p style="color: #64748B; font-size: 12px; text-align: center; margin-top: 30px;">
          Make Music Studio - Bruxelles
        </p>
      </body>
      </html>
    `;
  }

  await resend.emails.send({
    from: 'Make Music Studio <noreply@studiomakemusic.com>',
    to: [booking.client_email],
    subject,
    html
  });

  logStep("Rejection email sent to client", { email: booking.client_email });
}

// Send admin notification email when booking is confirmed or rejected
async function sendAdminNotification(resend: Resend, booking: any, action: 'confirmed' | 'rejected', driveLink?: string): Promise<void> {
  const adminEmail = 'prod.makemusic@gmail.com';
  const sessionDate = new Date(booking.session_date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const isConfirmed = action === 'confirmed';
  const statusColor = isConfirmed ? '#10B981' : '#EF4444';
  const statusBg = isConfirmed ? '#ECFDF5' : '#FEF2F2';
  const statusText = isConfirmed ? 'CONFIRMÉE' : 'REFUSÉE';
  const statusIcon = isConfirmed ? '✅' : '❌';
  const subject = isConfirmed 
    ? `✅ Session confirmée - ${booking.client_name} - ${sessionDate}`
    : `❌ Session refusée - ${booking.client_name} - ${sessionDate}`;

  const driveSectionHtml = driveLink ? `
      <div style="background: linear-gradient(135deg, #4285F4 0%, #34A853 100%); border-radius: 8px; padding: 16px; margin-bottom: 20px; color: white;">
        <p style="margin: 0 0 8px 0; font-weight: bold;">📁 Dossier Drive créé:</p>
        <a href="${driveLink}" target="_blank" style="color: white; word-break: break-all;">${driveLink}</a>
      </div>
  ` : '';

  const refundInfo = !isConfirmed && booking.amount_paid > 0 ? `
      <div style="background-color: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <p style="color: #92400E; margin: 0;">
          <strong>💰 Remboursement:</strong> ${booking.amount_paid}€ - Processus lancé automatiquement
        </p>
      </div>
  ` : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <div style="background-color: ${statusBg}; border: 2px solid ${statusColor}; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
        <h2 style="color: ${statusColor}; margin: 0 0 8px 0; font-size: 24px;">${statusIcon} Session ${statusText}</h2>
      </div>
      
      <div style="background-color: #F8FAFC; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 16px 0; color: #1E293B;">Détails de la session</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748B;">Client</td>
            <td style="padding: 8px 0; color: #1E293B; text-align: right; font-weight: 500;">${booking.client_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748B;">Email</td>
            <td style="padding: 8px 0; color: #1E293B; text-align: right; font-weight: 500;">${booking.client_email}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748B;">Téléphone</td>
            <td style="padding: 8px 0; color: #1E293B; text-align: right; font-weight: 500;">${booking.client_phone || 'Non fourni'}</td>
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
            <td style="padding: 8px 0; color: #64748B;">Montant</td>
            <td style="padding: 8px 0; color: #1E293B; text-align: right; font-weight: 500;">${booking.amount_paid}€</td>
          </tr>
        </table>
      </div>

      ${driveSectionHtml}
      ${refundInfo}
      
      <p style="color: #64748B; font-size: 12px; text-align: center; margin-top: 30px;">
        Make Music Studio - Notification automatique
      </p>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: 'Make Music Studio <noreply@studiomakemusic.com>',
    to: [adminEmail],
    subject,
    html
  });

  logStep("Admin notification sent", { email: adminEmail, action });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const action = url.searchParams.get('action');
    
    if (!token || !action) {
      throw new Error('Missing token or action parameter');
    }
    
    logStep("Processing action", { token, action });
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    
    // Find booking by validation token
    const { data: booking, error: fetchError } = await supabaseClient
      .from('bookings')
      .select('*')
      .eq('validation_token', token)
      .single();
    
    if (fetchError || !booking) {
      logStep("Booking not found", { error: fetchError?.message });
      throw new Error('Réservation non trouvée');
    }
    
    if (booking.status === 'confirmed' || booking.status === 'rejected') {
      // Already processed, redirect to status page
      const origin = req.headers.get("origin") || "https://makemusicstudio.be";
      return Response.redirect(`${origin}/booking-status?status=${booking.status}`, 302);
    }
    
    if (action === 'confirm') {
      const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
      const calendarId = Deno.env.get("GOOGLE_STUDIO_CALENDAR_ID");
      
      let googleEventId = null;
      let driveLink: string | undefined = undefined;
      let clientRootDriveLink: string | undefined = undefined;

      // Try to get studio config from database for Drive parent folder
      let studioServiceAccountKey = serviceAccountKey;
      let studioCalendarId = calendarId;
      let parentFolderId: string | null = null;

      // Try to get config from booking's studio or first configured studio
      const { data: studioData } = await supabaseClient
        .from("studios")
        .select("google_drive_parent_folder_id, google_service_account_key, google_calendar_id")
        .not("google_drive_parent_folder_id", "is", null)
        .not("google_service_account_key", "is", null)
        .limit(1)
        .maybeSingle();

      if (studioData) {
        parentFolderId = studioData.google_drive_parent_folder_id;
        if (studioData.google_service_account_key) studioServiceAccountKey = studioData.google_service_account_key;
        if (studioData.google_calendar_id) studioCalendarId = studioData.google_calendar_id;
      }

      const effectiveServiceAccountKey = studioServiceAccountKey || serviceAccountKey;

      if (effectiveServiceAccountKey) {
        // Get access tokens for Calendar and Drive
        const calendarAccessToken = await getAccessToken(effectiveServiceAccountKey);
        const driveAccessToken = await getDriveAccessToken(effectiveServiceAccountKey);
        
        // Add to Google Calendar
        if (studioCalendarId || calendarId) {
          googleEventId = await addToGoogleCalendar(calendarAccessToken, studioCalendarId || calendarId!, booking);
        }
        
        // Create Google Drive folder for client
        if (parentFolderId) {
          const driveFolderResult = await createClientDriveFolder(supabaseClient, driveAccessToken, booking, parentFolderId);
          if (driveFolderResult) {
            driveLink = driveFolderResult.subfolderLink;
            clientRootDriveLink = driveFolderResult.clientFolderLink;
            logStep("Drive folder created", {
              clientFolder: driveFolderResult.clientFolderLink,
              sessionFolder: driveFolderResult.subfolderLink
            });
          }
        } else {
          logStep("No parent folder ID configured for Drive");
        }
      }

      // Update booking status
      const { error: updateError } = await supabaseClient
        .from('bookings')
        .update({
          status: 'confirmed',
          conflict_resolved: true,
          google_calendar_event_id: googleEventId
        })
        .eq('id', booking.id);
      
      if (updateError) {
        throw new Error(`Failed to update booking: ${updateError.message}`);
      }
      
      // Send confirmation to client with Drive link
      await sendClientFinalConfirmation(resend, booking, driveLink, clientRootDriveLink);

      // Send notification to admin
      await sendAdminNotification(resend, booking, 'confirmed', driveLink);
      
      logStep("Booking confirmed", { bookingId: booking.id, hasDriveLink: !!driveLink });
      
      // Return HTML success page directly
      const successHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Session confirmée | Make Music Studio</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex; 
              justify-content: center; 
              align-items: center; 
              min-height: 100vh; 
              background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
              color: white;
              padding: 20px;
            }
            .container { 
              text-align: center; 
              padding: 40px;
              background: rgba(255, 255, 255, 0.05);
              border-radius: 16px;
              border: 1px solid rgba(255, 255, 255, 0.1);
              max-width: 400px;
              width: 100%;
            }
            .icon { 
              width: 80px; 
              height: 80px; 
              margin: 0 auto 20px;
              color: #10B981;
            }
            h1 { 
              color: #10B981; 
              font-size: 24px;
              margin-bottom: 16px;
            }
            p { 
              color: #94a3b8; 
              line-height: 1.6;
              margin-bottom: 12px;
            }
            .name { 
              color: #ffffff; 
              font-weight: 600;
            }
            .btn {
              display: inline-block;
              margin-top: 24px;
              padding: 12px 24px;
              background: #10B981;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 500;
              transition: background 0.2s;
            }
            .btn:hover { background: #059669; }
          </style>
        </head>
        <body>
          <div class="container">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <h1>Session confirmée !</h1>
            <p>La session de <span class="name">${booking.client_name}</span> a été confirmée avec succès.</p>
            <p>Un email de confirmation a été envoyé au client avec tous les détails.</p>
            <a href="https://makemusicstudio.be" class="btn">Retour à l'accueil</a>
          </div>
        </body>
        </html>
      `;
      
      return new Response(successHtml, {
        headers: { ...corsHeaders, "Content-Type": "text/html" },
        status: 200,
      });
      
    } else if (action === 'reject') {
      // Process refund via Stripe
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      
      if (stripeKey && booking.stripe_payment_intent_id) {
        try {
          const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
          await stripe.refunds.create({
            payment_intent: booking.stripe_payment_intent_id,
            reason: 'requested_by_customer'
          });
          logStep("Refund processed", { paymentIntentId: booking.stripe_payment_intent_id });
        } catch (refundError) {
          logStep("Refund error", { error: refundError instanceof Error ? refundError.message : String(refundError) });
          // Continue anyway, admin can process manually
        }
      }
      
      // Delete event from Google Calendar if it exists
      const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
      const studioCalendarId = Deno.env.get("GOOGLE_STUDIO_CALENDAR_ID");
      
      if (booking.google_calendar_event_id && serviceAccountKey && studioCalendarId) {
        try {
          const calendarAccessToken = await getAccessToken(serviceAccountKey);
          const deleted = await deleteFromGoogleCalendar(calendarAccessToken, studioCalendarId, booking.google_calendar_event_id);
          if (deleted) {
            logStep("Calendar event deleted", { eventId: booking.google_calendar_event_id });
          }
        } catch (calendarError) {
          logStep("Error deleting calendar event", { error: calendarError instanceof Error ? calendarError.message : String(calendarError) });
          // Continue anyway - don't block the rejection
        }
      } else {
        logStep("No calendar event to delete", { 
          hasEventId: !!booking.google_calendar_event_id, 
          hasServiceKey: !!serviceAccountKey, 
          hasCalendarId: !!studioCalendarId 
        });
      }
      
      // Update booking status and clear calendar event ID
      const { error: updateError } = await supabaseClient
        .from('bookings')
        .update({
          status: 'rejected',
          conflict_resolved: true,
          google_calendar_event_id: null
        })
        .eq('id', booking.id);
      
      if (updateError) {
        throw new Error(`Failed to update booking: ${updateError.message}`);
      }
      
      // Send rejection email to client
      await sendClientRejectionEmail(resend, booking);
      
      // Send notification to admin
      await sendAdminNotification(resend, booking, 'rejected');
      
      logStep("Booking rejected", { bookingId: booking.id, calendarEventDeleted: !!booking.google_calendar_event_id });
      
      // Return HTML rejection page directly
      const rejectHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Session annulée | Make Music Studio</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex; 
              justify-content: center; 
              align-items: center; 
              min-height: 100vh; 
              background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
              color: white;
              padding: 20px;
            }
            .container { 
              text-align: center; 
              padding: 40px;
              background: rgba(255, 255, 255, 0.05);
              border-radius: 16px;
              border: 1px solid rgba(255, 255, 255, 0.1);
              max-width: 400px;
              width: 100%;
            }
            .icon { 
              width: 80px; 
              height: 80px; 
              margin: 0 auto 20px;
              color: #EF4444;
            }
            h1 { 
              color: #EF4444; 
              font-size: 24px;
              margin-bottom: 16px;
            }
            p { 
              color: #94a3b8; 
              line-height: 1.6;
              margin-bottom: 12px;
            }
            .name { 
              color: #ffffff; 
              font-weight: 600;
            }
            .btn {
              display: inline-block;
              margin-top: 24px;
              padding: 12px 24px;
              background: #64748b;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 500;
              transition: background 0.2s;
            }
            .btn:hover { background: #475569; }
          </style>
        </head>
        <body>
          <div class="container">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <h1>Session annulée</h1>
            <p>La session de <span class="name">${booking.client_name}</span> a été annulée.</p>
            <p>Le remboursement a été initié et le client a été notifié par email.</p>
            <a href="https://makemusicstudio.be" class="btn">Retour à l'accueil</a>
          </div>
        </body>
        </html>
      `;
      
      return new Response(rejectHtml, {
        headers: { ...corsHeaders, "Content-Type": "text/html" },
        status: 200,
      });
    }
    
    throw new Error('Invalid action');
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    // Return HTML error page
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Erreur</title>
        <style>
          body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #1a1a2e; color: white; }
          .container { text-align: center; padding: 40px; }
          h1 { color: #EF4444; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Erreur</h1>
          <p>${errorMessage}</p>
        </div>
      </body>
      </html>
    `;
    
    return new Response(html, {
      headers: { ...corsHeaders, "Content-Type": "text/html" },
      status: 400,
    });
  }
});
