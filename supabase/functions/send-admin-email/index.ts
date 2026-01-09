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

    const ADMIN_EMAILS = ["prod.makemusic@gmail.com", "kazamzamka@gmail.com"];
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

    // Create Drive folder if requested
    let driveFolderLink = null;
    if (includeDriveLink && clientEmail) {
      try {
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

        if (!folderError && folderData?.folderLink) {
          driveFolderLink = folderData.folderLink;
          logStep("Drive folder created", { link: driveFolderLink });
        }
      } catch (driveError) {
        console.error("Drive folder error:", driveError);
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
      <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">🎵 Make Music</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Détails de votre session</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 40px 30px;">
      <p style="color: #e0e0e0; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Bonjour ${clientName || 'Artiste'},
      </p>
      
      ${customMessage ? `
      <p style="color: #e0e0e0; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
        ${customMessage}
      </p>
      ` : ''}
      
      <!-- Session Info Box -->
      <div style="background: rgba(0, 212, 255, 0.1); border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 12px; padding: 25px; margin: 0 0 30px 0;">
        <h2 style="color: #00d4ff; margin: 0 0 15px 0; font-size: 20px;">📅 Détails de la session</h2>
        <p style="color: #a0a0a0; margin: 0 0 10px 0; font-size: 14px;">
          <strong style="color: #e0e0e0;">Service :</strong> ${serviceLabels[sessionType] || sessionType}
        </p>
        ${sessionDate ? `
        <p style="color: #a0a0a0; margin: 0 0 10px 0; font-size: 14px;">
          <strong style="color: #e0e0e0;">Date :</strong> ${sessionDate}
        </p>
        ` : ''}
        ${sessionTime ? `
        <p style="color: #a0a0a0; margin: 0 0 10px 0; font-size: 14px;">
          <strong style="color: #e0e0e0;">Heure :</strong> ${sessionTime}
        </p>
        ` : ''}
        ${hours ? `
        <p style="color: #a0a0a0; margin: 0 0 10px 0; font-size: 14px;">
          <strong style="color: #e0e0e0;">Durée :</strong> ${hours}h
        </p>
        ` : ''}
        <p style="color: #ffd700; margin: 15px 0 0 0; font-size: 18px; font-weight: bold;">
          💰 Montant : ${totalPrice}€
        </p>
      </div>
      
      ${stripePaymentUrl ? `
      <!-- Payment Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="${stripePaymentUrl}" style="display: inline-block; background: linear-gradient(90deg, #00d4ff 0%, #7c3aed 100%); color: white; text-decoration: none; padding: 18px 40px; border-radius: 50px; font-size: 18px; font-weight: bold; box-shadow: 0 8px 30px rgba(0, 212, 255, 0.4);">
          💳 Payer maintenant
        </a>
      </div>
      ` : ''}
      
      ${driveFolderLink ? `
      <!-- Drive Link -->
      <div style="background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 12px; padding: 20px; margin: 30px 0;">
        <h3 style="color: #ffc107; margin: 0 0 15px 0; font-size: 16px;">📁 Votre dossier Google Drive</h3>
        <p style="color: #a0a0a0; margin: 0 0 15px 0; font-size: 14px;">
          Vous pouvez déposer vos fichiers audio ici :
        </p>
        <a href="${driveFolderLink}" style="display: inline-block; background: #ffc107; color: #1a1a1a; text-decoration: none; padding: 12px 25px; border-radius: 8px; font-size: 14px; font-weight: bold;">
          📂 Ouvrir le dossier
        </a>
      </div>
      ` : ''}
      
      <!-- Studio Address -->
      <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; margin: 30px 0 0 0;">
        <h3 style="color: #e0e0e0; margin: 0 0 10px 0; font-size: 16px;">📍 Adresse du studio</h3>
        <p style="color: #a0a0a0; margin: 0; font-size: 14px;">
          Rue du Sceptre 22, 1050 Ixelles, Bruxelles
        </p>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background: rgba(0,0,0,0.3); padding: 25px 30px; text-align: center;">
      <p style="color: #666; margin: 0; font-size: 12px;">
        Make Music Studio • Rue du Sceptre 22, 1050 Ixelles, Bruxelles
      </p>
      <p style="color: #666; margin: 10px 0 0 0; font-size: 12px;">
        📧 prod.makemusic@gmail.com • 📞 +32 476 09 41 72
      </p>
    </div>
  </div>
</body>
</html>
    `;

    // Send to client
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@studiomakemusic.com";
    const fromAddress = fromEmail.includes("<") ? fromEmail : `Make Music Studio <${fromEmail}>`;
    const adminEmailAddress = "prod.makemusic@gmail.com";
    
    logStep("Sending email", { from: fromAddress, to: clientEmail });
    
    const { data: clientEmailData, error: clientEmailError } = await resend.emails.send({
      from: fromAddress,
      to: [clientEmail],
      reply_to: adminEmailAddress,
      subject: `🎵 Make Music - ${serviceLabels[sessionType] || sessionType}`,
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
      subject: `[COPIE] Email envoyé à ${clientEmail} - ${serviceLabels[sessionType] || sessionType}`,
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
