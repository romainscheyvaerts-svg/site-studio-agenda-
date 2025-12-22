import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[BOOKING-ACTION] ${step}${detailsStr}`);
};

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
  
  const startDateTime = `${sessionDate}T${startTime}:00`;
  const endDateTime = `${sessionDate}T${endTime}:00`;
  
  const event = {
    summary: `${booking.session_type} - ${booking.client_name}`,
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

// Send confirmation email to client
async function sendClientFinalConfirmation(resend: Resend, booking: any): Promise<void> {
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
        <p style="margin: 10px 0 0 0; opacity: 0.8;">Votre session est confirmée !</p>
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
  
  await resend.emails.send({
    from: 'Make Music Studio <onboarding@resend.dev>',
    to: [booking.client_email],
    subject: `✓ Session confirmée - ${sessionDate}`,
    html
  });
  
  logStep("Final confirmation sent to client", { email: booking.client_email });
}

// Send rejection/refund email to client
async function sendClientRejectionEmail(resend: Resend, booking: any): Promise<void> {
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
  
  await resend.emails.send({
    from: 'Make Music Studio <onboarding@resend.dev>',
    to: [booking.client_email],
    subject: `Information sur votre réservation - ${sessionDate}`,
    html
  });
  
  logStep("Rejection email sent to client", { email: booking.client_email });
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
      // Add to Google Calendar
      const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
      const calendarId = Deno.env.get("GOOGLE_STUDIO_CALENDAR_ID");
      
      let googleEventId = null;
      if (serviceAccountKey && calendarId) {
        const accessToken = await getAccessToken(serviceAccountKey);
        googleEventId = await addToGoogleCalendar(accessToken, calendarId, booking);
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
      
      // Send confirmation to client
      await sendClientFinalConfirmation(resend, booking);
      
      logStep("Booking confirmed", { bookingId: booking.id });
      
      // Redirect to success page
      const origin = req.headers.get("origin") || "https://makemusicstudio.be";
      return Response.redirect(`${origin}/booking-status?status=confirmed&name=${encodeURIComponent(booking.client_name)}`, 302);
      
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
      
      // Update booking status
      const { error: updateError } = await supabaseClient
        .from('bookings')
        .update({
          status: 'rejected',
          conflict_resolved: true
        })
        .eq('id', booking.id);
      
      if (updateError) {
        throw new Error(`Failed to update booking: ${updateError.message}`);
      }
      
      // Send rejection email to client
      await sendClientRejectionEmail(resend, booking);
      
      logStep("Booking rejected", { bookingId: booking.id });
      
      // Redirect to rejection page
      const origin = req.headers.get("origin") || "https://makemusicstudio.be";
      return Response.redirect(`${origin}/booking-status?status=rejected&name=${encodeURIComponent(booking.client_name)}`, 302);
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
