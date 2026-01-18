import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { renderEmailHtml, TemplateVariables } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-ADMIN-EMAIL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const ADMIN_EMAILS = ["prod.makemusic@gmail.com", "kazamzamka@gmail.com", "romain.scheyvaerts@gmail.com"];
    if (!user.email || !ADMIN_EMAILS.includes(user.email)) {
      throw new Error("Admin access required");
    }

    const {
      clientEmail,
      clientName,
      sessionType,
      sessionDate,
      sessionTime,
      hours,
      totalPrice,
      includeStripeLink,
      includeDriveLink,
      customMessage,
    } = await req.json();

    logStep("Request data", { clientEmail, sessionType, totalPrice, includeStripeLink, includeDriveLink });

    if (!clientEmail) {
      throw new Error("Client email is required");
    }

    // Generate Stripe payment link if requested
    let stripePaymentUrl = null;
    if (includeStripeLink && totalPrice > 0) {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (stripeKey) {
        try {
          const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
          
          // Create a payment link for the amount
          const paymentLink = await stripe.paymentLinks.create({
            line_items: [
              {
                price_data: {
                  currency: 'eur',
                  product_data: {
                    name: `Session ${sessionType} - Make Music Studio`,
                    description: sessionDate ? `${sessionDate} à ${sessionTime || 'horaire à confirmer'}` : 'Session studio',
                  },
                  unit_amount: Math.round(totalPrice * 100),
                },
                quantity: 1,
              },
            ],
          });
          
          stripePaymentUrl = paymentLink.url;
          logStep("Stripe payment link created", { url: stripePaymentUrl });
        } catch (stripeError) {
          console.error("Stripe error:", stripeError);
          // Continue without Stripe link
        }
      }
    }

    // Create Drive folder if requested OR use existing folder link passed in request
    let driveFolderLink = null;
    if (includeDriveLink && clientEmail) {
      try {
        logStep("Calling create-client-subfolder", { clientEmail, clientName, sessionDate });

        const { data: folderData, error: folderError } = await supabaseAdmin.functions.invoke(
          "create-client-subfolder",
          {
            body: {
              clientName: clientName || clientEmail.split("@")[0],
              clientEmail,
              sessionDate: sessionDate || new Date().toISOString().split("T")[0],
            },
          }
        );

        logStep("create-client-subfolder response", {
          folderData: JSON.stringify(folderData),
          folderError: folderError ? JSON.stringify(folderError) : null
        });

        // create-client-subfolder returns subfolderLink (session-specific) and clientFolderLink (main client folder)
        if (folderError) {
          logStep("Drive folder error from function", { error: JSON.stringify(folderError) });
        } else if (folderData?.subfolderLink || folderData?.clientFolderLink) {
          driveFolderLink = folderData.subfolderLink || folderData.clientFolderLink;
          logStep("Drive folder link set", { link: driveFolderLink });
        } else {
          logStep("No drive folder link in response", { folderData: JSON.stringify(folderData) });
        }
      } catch (driveError) {
        logStep("Drive folder exception", { error: driveError instanceof Error ? driveError.message : String(driveError) });
        // Continue without Drive link
      }
    }

    // Send email
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);

    const serviceLabels: Record<string, string> = {
      "with-engineer": "Session avec ingénieur son",
      "without-engineer": "Location sèche",
      "mixing": "Mixage",
      "mastering": "Mastering numérique",
      "analog-mastering": "Mastering analogique",
      "podcast": "Mixage podcast",
    };

    // Generate Google Calendar link
    let googleCalendarLink = "";
    if (sessionDate && sessionTime) {
      const [year, month, day] = sessionDate.split("-");
      const [hour, minute] = sessionTime.split(":");
      const startDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute || "0"));
      const endDate = new Date(startDate.getTime() + (hours || 1) * 60 * 60 * 1000);

      const formatDate = (d: Date) => {
        return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
      };

      const calendarTitle = encodeURIComponent(`Session Make Music - ${serviceLabels[sessionType] || sessionType}`);
      const calendarDetails = encodeURIComponent(`Session de ${hours || 1}h au studio Make Music.\n\nMontant: ${totalPrice}€\n\nAdresse: Rue du Sceptre 22, 1050 Ixelles, Bruxelles`);
      const calendarLocation = encodeURIComponent("Rue du Sceptre 22, 1050 Ixelles, Bruxelles");

      googleCalendarLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calendarTitle}&dates=${formatDate(startDate)}/${formatDate(endDate)}&details=${calendarDetails}&location=${calendarLocation}`;
    }

    // Prepare template variables
    const templateVars: TemplateVariables = {
      client_name: clientName || 'Artiste',
      client_email: clientEmail,
      service_type: serviceLabels[sessionType] || sessionType,
      session_date: sessionDate,
      start_time: sessionTime,
      amount_paid: String(totalPrice),
      total_amount: String(totalPrice),
      drive_link: driveFolderLink,
      calendar_link: googleCalendarLink,
      message: customMessage,
    };

    // Build extra content for template
    const extraContentHtml = `
      ${customMessage ? `
      <div style="background: rgba(124, 58, 237, 0.2); border-left: 4px solid #7c3aed; border-radius: 8px; padding: 20px; margin: 0 0 20px 0;">
        <p style="color: #ffffff; font-size: 16px; line-height: 1.6; margin: 0; white-space: pre-wrap;">
          ${customMessage}
        </p>
      </div>
      ` : ''}

      <div style="background: rgba(0, 212, 255, 0.1); border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 12px; padding: 25px; margin: 0 0 20px 0;">
        <h2 style="color: #00d4ff; margin: 0 0 15px 0; font-size: 20px;">📅 Détails de la session</h2>
        <p style="color: #a0a0a0; margin: 0 0 10px 0; font-size: 14px;">
          <strong style="color: #ffffff;">Service :</strong> ${serviceLabels[sessionType] || sessionType}
        </p>
        ${sessionDate ? `<p style="color: #a0a0a0; margin: 0 0 10px 0; font-size: 14px;"><strong style="color: #ffffff;">Date :</strong> ${sessionDate}</p>` : ''}
        ${sessionTime ? `<p style="color: #a0a0a0; margin: 0 0 10px 0; font-size: 14px;"><strong style="color: #ffffff;">Heure :</strong> ${sessionTime}</p>` : ''}
        ${hours ? `<p style="color: #a0a0a0; margin: 0 0 10px 0; font-size: 14px;"><strong style="color: #ffffff;">Durée :</strong> ${hours}h</p>` : ''}
        <p style="color: #ffd700; margin: 15px 0 0 0; font-size: 18px; font-weight: bold;">💰 Montant : ${totalPrice}€</p>
      </div>

      <div style="text-align: center; margin: 20px 0;">
        ${stripePaymentUrl ? `<a href="${stripePaymentUrl}" style="display: inline-block; background: linear-gradient(90deg, #00d4ff 0%, #7c3aed 100%); color: white; text-decoration: none; padding: 18px 40px; border-radius: 50px; font-size: 16px; font-weight: bold; box-shadow: 0 8px 30px rgba(0, 212, 255, 0.4); margin-bottom: 15px;">💳 Payer maintenant (${totalPrice}€)</a><br><br>` : ''}
        ${googleCalendarLink ? `<a href="${googleCalendarLink}" target="_blank" style="display: inline-block; background: rgba(255, 255, 255, 0.1); border: 2px solid #00d4ff; color: #00d4ff; text-decoration: none; padding: 14px 30px; border-radius: 50px; font-size: 14px; font-weight: bold;">📆 Ajouter à mon agenda</a>` : ''}
      </div>

      ${driveFolderLink ? `
      <div style="background: rgba(255, 193, 7, 0.15); border: 1px solid rgba(255, 193, 7, 0.4); border-radius: 12px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #ffc107; margin: 0 0 15px 0; font-size: 16px;">📁 Votre dossier Google Drive</h3>
        <p style="color: #ffffff; margin: 0 0 15px 0; font-size: 14px;">Vous pouvez déposer vos fichiers audio ici :</p>
        <a href="${driveFolderLink}" style="display: inline-block; background: #ffc107; color: #1a1a1a; text-decoration: none; padding: 12px 25px; border-radius: 8px; font-size: 14px; font-weight: bold;">📂 Ouvrir le dossier Drive</a>
      </div>
      ` : ''}
    `;

    // Try to use template from database
    const templateResult = await renderEmailHtml("admin_session_email", templateVars, { extraContent: extraContentHtml });

    let emailSubject: string;
    let emailHtml: string;

    if (templateResult) {
      emailSubject = templateResult.subject;
      emailHtml = templateResult.html;
      logStep("Using database template for admin_session_email");
    } else {
      // Fallback to hardcoded template
      logStep("Using fallback template for admin_session_email");
      emailSubject = `🎵 Make Music - ${serviceLabels[sessionType] || sessionType}`;
      emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a; margin: 0; padding: 40px 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">

    <div style="background: linear-gradient(90deg, #00d4ff 0%, #7c3aed 100%); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">🎵 Make Music</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Détails de votre session</p>
    </div>

    <div style="padding: 40px 30px;">
      <p style="color: #ffffff; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Bonjour ${clientName || 'Artiste'},
      </p>

      ${extraContentHtml}

      <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; margin: 30px 0 0 0;">
        <h3 style="color: #ffffff; margin: 0 0 10px 0; font-size: 16px;">📍 Adresse du studio</h3>
        <p style="color: #a0a0a0; margin: 0 0 10px 0; font-size: 14px;">
          Rue du Sceptre 22, 1050 Ixelles, Bruxelles
        </p>
        <a href="https://maps.google.com/?q=Rue+du+Sceptre+22,+1050+Ixelles,+Bruxelles" style="color: #00d4ff; font-size: 14px; text-decoration: none;">
          🗺️ Voir sur Google Maps
        </a>
      </div>
    </div>

    <div style="background: rgba(0,0,0,0.3); padding: 25px 30px; text-align: center;">
      <p style="color: #888; margin: 0; font-size: 12px;">
        Make Music Studio • Rue du Sceptre 22, 1050 Ixelles, Bruxelles
      </p>
      <p style="color: #888; margin: 10px 0 0 0; font-size: 12px;">
        📧 prod.makemusic@gmail.com • 📞 +32 476 09 41 72
      </p>
    </div>
  </div>
</body>
</html>
      `;
    }

    // Send to client
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@studiomakemusic.com";
    const fromAddress = fromEmail.includes("<") ? fromEmail : `Make Music Studio <${fromEmail}>`;
    const adminEmailAddress = "prod.makemusic@gmail.com";
    
    logStep("Sending email", { from: fromAddress, to: clientEmail });
    
    const { data: clientEmailData, error: clientEmailError } = await resend.emails.send({
      from: fromAddress,
      to: [clientEmail],
      reply_to: adminEmailAddress,
      subject: emailSubject,
      html: emailHtml,
    });

    if (clientEmailError) {
      logStep("Client email error", JSON.stringify(clientEmailError));
      throw new Error("Failed to send email to client");
    }

    logStep("Email sent to client", { id: clientEmailData?.id });

    // Send copy to admin
    const { data: adminCopyData, error: adminCopyError } = await resend.emails.send({
      from: fromAddress,
      to: [adminEmailAddress],
      subject: `[COPIE] Email envoyé à ${clientEmail} - ${emailSubject}`,
      html: emailHtml,
    });

    if (adminCopyError) {
      logStep("Admin copy error (non-blocking)", JSON.stringify(adminCopyError));
    } else {
      logStep("Copy sent to admin", { id: adminCopyData?.id });
    }

    return new Response(
      JSON.stringify({
        success: true,
        stripePaymentUrl,
        driveFolderLink,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
