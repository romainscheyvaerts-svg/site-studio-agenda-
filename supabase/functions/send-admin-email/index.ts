import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { getEmailTranslations, getServiceLabel, formatDateForLang } from "../_shared/email-translations.ts";

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

    // Check admin role via user_roles or studio_members
    const { data: platformRoles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", user.id)
      .in("role", ["admin", "superadmin"]);
    
    const { data: studioRoles } = await supabaseAdmin
      .from("studio_members").select("role").eq("user_id", user.id)
      .in("role", ["owner", "admin"]);
    
    const isAdmin = (platformRoles && platformRoles.length > 0) || (studioRoles && studioRoles.length > 0);
    
    if (!isAdmin) {
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
      studioId,
      lang, // NEW: language parameter (fr, en, nl, es)
    } = await req.json();

    // Get translations based on language
    const t = getEmailTranslations(lang);
    const sessionLabel = getServiceLabel(sessionType, lang);

    logStep("Request data", { clientEmail, sessionType, totalPrice, includeStripeLink, includeDriveLink, studioId, lang });

    if (!clientEmail) {
      throw new Error("Client email is required");
    }

    // Fetch studio configuration
    let studioData: any = null;
    if (studioId) {
      const { data } = await supabaseAdmin
        .from("studios")
        .select("name, email, phone, resend_api_key, resend_from_email, stripe_secret_key, email_greeting, email_custom_message, email_noreply_text, email_show_phone, email_show_google_calendar, email_show_drive_link, email_footer_text, email_contact_text, address")
        .eq("id", studioId)
        .single();
      studioData = data;
    }

    // Fallback: find studio from admin's membership
    if (!studioData) {
      const { data: membership } = await supabaseAdmin
        .from("studio_members")
        .select("studio_id")
        .eq("user_id", user.id)
        .in("role", ["owner", "admin"])
        .limit(1)
        .single();

      if (membership?.studio_id) {
        const { data } = await supabaseAdmin
          .from("studios")
          .select("name, email, phone, resend_api_key, resend_from_email, stripe_secret_key, address")
          .eq("id", membership.studio_id)
          .single();
        studioData = data;
      }
    }

    logStep("Studio data", { 
      hasStudioData: !!studioData, 
      hasResendKey: !!studioData?.resend_api_key,
      fromEmail: studioData?.resend_from_email,
      studioName: studioData?.name 
    });

    // Get Resend API key
    const resendApiKey = studioData?.resend_api_key || Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured. Please set it in Studio Settings > Emails.");
    }

    // Determine from address
    const configuredFromEmail = studioData?.resend_from_email || Deno.env.get("RESEND_FROM_EMAIL");
    const studioName = studioData?.name || "Studio";
    const studioEmail = studioData?.email || "noreply@studio.com";
    const studioPhone = studioData?.phone || "";
    const studioAddress = studioData?.address || "";

    let fromAddress: string;
    if (configuredFromEmail && !configuredFromEmail.includes("gmail.com") && !configuredFromEmail.includes("hotmail.") && !configuredFromEmail.includes("yahoo.")) {
      fromAddress = configuredFromEmail.includes("<") ? configuredFromEmail : `${studioName} <${configuredFromEmail}>`;
    } else {
      fromAddress = `${studioName} <onboarding@resend.dev>`;
      logStep("WARNING: Using Resend onboarding email. Configure a verified domain email in Studio Settings.");
    }

    logStep("From address resolved", { fromAddress });

    // Generate Stripe payment link if requested
    let stripePaymentUrl = null;
    if (includeStripeLink && totalPrice > 0) {
      const stripeKey = studioData?.stripe_secret_key || Deno.env.get("STRIPE_SECRET_KEY");
      if (stripeKey) {
        try {
          const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
          
          const paymentLink = await stripe.paymentLinks.create({
            line_items: [
              {
                price_data: {
                  currency: 'eur',
                  product_data: {
                    name: `${sessionLabel} - ${studioName}`,
                    description: sessionDate ? `${formatDateForLang(sessionDate, lang)} ${sessionTime ? `• ${sessionTime}` : ''}` : sessionLabel,
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
        }
      }
    }

    // Create Drive folder if requested
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

        if (folderError) {
          logStep("Drive folder error", { error: JSON.stringify(folderError) });
        } else if (folderData?.subfolderLink || folderData?.clientFolderLink) {
          driveFolderLink = folderData.subfolderLink || folderData.clientFolderLink;
          logStep("Drive folder link set", { link: driveFolderLink });
        }
      } catch (driveError) {
        logStep("Drive folder exception", { error: driveError instanceof Error ? driveError.message : String(driveError) });
      }
    }

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

      const calendarTitle = encodeURIComponent(`${sessionLabel} - ${studioName}`);
      const calendarDetails = encodeURIComponent(`${sessionLabel}\n${hours || 1}h\n${totalPrice}€`);

      googleCalendarLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calendarTitle}&dates=${formatDate(startDate)}/${formatDate(endDate)}&details=${calendarDetails}${studioAddress ? `&location=${encodeURIComponent(studioAddress)}` : ''}`;
    }

    // Email template settings from DB
    const emailGreeting = studioData?.email_greeting 
      ? studioData.email_greeting.replace("{clientName}", clientName || (lang === "en" ? "Artist" : lang === "nl" ? "Artiest" : lang === "es" ? "Artista" : "Artiste"))
      : t.greeting(clientName || (lang === "en" ? "Artist" : lang === "nl" ? "Artiest" : lang === "es" ? "Artista" : "Artiste"));
    
    const emailCustomMsg = studioData?.email_custom_message || "";
    const emailNoreplyText = studioData?.email_noreply_text || t.noReplyWarning;
    const emailShowPhone = studioData?.email_show_phone ?? true;
    const emailShowCalendar = studioData?.email_show_google_calendar ?? true;
    const emailShowDrive = studioData?.email_show_drive_link ?? true;
    const emailFooter = studioData?.email_footer_text || studioName;
    const emailContactText = studioData?.email_contact_text || "";
    const formattedDate = sessionDate ? formatDateForLang(sessionDate, lang) : "";

    // Build email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a; margin: 0; padding: 40px 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">

    <!-- Header -->
    <div style="background: linear-gradient(90deg, #00d4ff 0%, #7c3aed 100%); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">🎵 ${studioName}</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">${t.sessionDetails}</p>
    </div>

    <div style="padding: 40px 30px;">
      <!-- Greeting -->
      <p style="color: #ffffff; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        ${emailGreeting}
      </p>

      <!-- No-reply warning -->
      ${emailNoreplyText ? `
      <div style="background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 8px; padding: 15px; margin: 0 0 20px 0;">
        <p style="color: #ffc107; font-size: 13px; margin: 0; text-align: center;">${emailNoreplyText}</p>
      </div>
      ` : ''}

      <!-- Custom messages -->
      ${emailCustomMsg ? `
      <div style="background: rgba(124, 58, 237, 0.2); border-left: 4px solid #7c3aed; border-radius: 8px; padding: 20px; margin: 0 0 20px 0;">
        <p style="color: #ffffff; font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${emailCustomMsg}</p>
      </div>
      ` : ''}

      ${customMessage ? `
      <div style="background: rgba(124, 58, 237, 0.2); border-left: 4px solid #7c3aed; border-radius: 8px; padding: 20px; margin: 0 0 20px 0;">
        <p style="color: #ffffff; font-size: 16px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${customMessage}</p>
      </div>
      ` : ''}

      <!-- Session details -->
      <div style="background: rgba(0, 212, 255, 0.1); border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 12px; padding: 25px; margin: 0 0 20px 0;">
        <h2 style="color: #00d4ff; margin: 0 0 15px 0; font-size: 20px;">📅 ${t.sessionDetails}</h2>
        <p style="color: #a0a0a0; margin: 0 0 10px 0; font-size: 14px;">
          <strong style="color: #ffffff;">${t.service} :</strong> ${sessionLabel}
        </p>
        ${formattedDate ? `<p style="color: #a0a0a0; margin: 0 0 10px 0; font-size: 14px;"><strong style="color: #ffffff;">${t.date} :</strong> ${formattedDate}</p>` : ''}
        ${sessionTime ? `<p style="color: #a0a0a0; margin: 0 0 10px 0; font-size: 14px;"><strong style="color: #ffffff;">${t.time} :</strong> ${sessionTime}</p>` : ''}
        ${hours ? `<p style="color: #a0a0a0; margin: 0 0 10px 0; font-size: 14px;"><strong style="color: #ffffff;">${t.duration} :</strong> ${hours} ${t.hours}</p>` : ''}
        <p style="color: #ffd700; margin: 15px 0 0 0; font-size: 18px; font-weight: bold;">💰 ${t.amount} : ${totalPrice}€</p>
      </div>

      <!-- Action buttons -->
      <div style="text-align: center; margin: 20px 0;">
        ${stripePaymentUrl ? `<a href="${stripePaymentUrl}" style="display: inline-block; background: linear-gradient(90deg, #00d4ff 0%, #7c3aed 100%); color: white; text-decoration: none; padding: 18px 40px; border-radius: 50px; font-size: 16px; font-weight: bold; box-shadow: 0 8px 30px rgba(0, 212, 255, 0.4); margin-bottom: 15px;">${t.payNow(totalPrice)}</a><br><br>` : ''}
        ${emailShowCalendar && googleCalendarLink ? `<a href="${googleCalendarLink}" target="_blank" style="display: inline-block; background: rgba(255, 255, 255, 0.1); border: 2px solid #00d4ff; color: #00d4ff; text-decoration: none; padding: 14px 30px; border-radius: 50px; font-size: 14px; font-weight: bold;">${t.addToCalendar}</a>` : ''}
      </div>

      <!-- Drive folder -->
      ${emailShowDrive && driveFolderLink ? `
      <div style="background: rgba(255, 193, 7, 0.15); border: 1px solid rgba(255, 193, 7, 0.4); border-radius: 12px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #ffc107; margin: 0 0 15px 0; font-size: 16px;">${t.driveTitle}</h3>
        <p style="color: #ffffff; margin: 0 0 15px 0; font-size: 14px;">${t.driveDescription}</p>
        <a href="${driveFolderLink}" style="display: inline-block; background: #ffc107; color: #1a1a1a; text-decoration: none; padding: 12px 25px; border-radius: 8px; font-size: 14px; font-weight: bold;">${t.driveOpenFolder}</a>
      </div>
      ` : ''}

      <!-- Phone -->
      ${emailShowPhone && studioPhone ? `
      <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 15px; margin: 20px 0; text-align: center;">
        <p style="color: #ffffff; font-size: 14px; margin: 0;">📞 <strong>${studioPhone}</strong></p>
      </div>
      ` : ''}

      ${emailContactText ? `
      <p style="color: #a0a0a0; font-size: 13px; text-align: center; margin: 20px 0 0 0;">${emailContactText}</p>
      ` : ''}

    </div>

    <!-- Footer -->
    <div style="background: rgba(0,0,0,0.3); padding: 25px 30px; text-align: center;">
      <p style="color: #888; margin: 0; font-size: 12px;">${emailFooter}</p>
    </div>
  </div>
</body>
</html>
    `;

    const emailSubject = t.adminEmailSubject(studioName, sessionLabel);

    // Send email via Resend
    const resend = new Resend(resendApiKey);

    logStep("Sending email", { from: fromAddress, to: clientEmail, subject: emailSubject, lang });

    const { data: clientEmailData, error: clientEmailError } = await resend.emails.send({
      from: fromAddress,
      to: [clientEmail],
      reply_to: studioEmail,
      subject: emailSubject,
      html: emailHtml,
    });

    if (clientEmailError) {
      logStep("Client email error", JSON.stringify(clientEmailError));
      throw new Error(`Failed to send email: ${JSON.stringify(clientEmailError)}`);
    }

    logStep("Email sent to client", { id: clientEmailData?.id });

    // Send copy to admin/studio
    try {
      await resend.emails.send({
        from: fromAddress,
        to: [studioEmail],
        subject: `[COPIE] ${emailSubject}`,
        html: emailHtml,
      });
      logStep("Copy sent to studio admin");
    } catch (copyErr) {
      logStep("Admin copy error (non-blocking)", { error: String(copyErr) });
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
