import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { renderEmailHtml, TemplateVariables } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[DELIVER-INSTRUMENTAL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const requestBody = await req.json();
    const {
      instrumentalId,
      licenseId,
      licenseType, // For trusted user free downloads
      paymentId,
      paymentMethod,
      amountPaid,
      buyerEmail,
      buyerName,
      userId,
      isFreeDownload // Flag for trusted user free download
    } = requestBody;

    logStep("Request data", { instrumentalId, licenseId, licenseType, buyerEmail, isFreeDownload });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // If this is a free download for trusted user, verify trusted status
    if (isFreeDownload) {
      logStep("Checking trusted user status for free download");
      
      if (!userId) {
        throw new Error("User ID is required for free downloads");
      }

      const { data: trustedUser, error: trustedError } = await supabaseAdmin
        .from("trusted_users")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (trustedError) {
        logStep("Error checking trusted status", trustedError);
        throw new Error("Failed to verify trusted user status");
      }

      if (!trustedUser) {
        throw new Error("User is not authorized for free downloads");
      }

      logStep("Trusted user verified", { userId });
    }

    // Get instrumental details
    const { data: instrumental, error: instrumentalError } = await supabaseAdmin
      .from("instrumentals")
      .select("*")
      .eq("id", instrumentalId)
      .single();

    if (instrumentalError || !instrumental) {
      throw new Error(`Instrumental not found: ${instrumentalError?.message}`);
    }
    logStep("Instrumental found", { title: instrumental.title });

    // Get license details - either by ID or by name (for free downloads)
    let license;
    if (licenseId) {
      const { data, error } = await supabaseAdmin
        .from("instrumental_licenses")
        .select("*")
        .eq("id", licenseId)
        .single();
      
      if (error || !data) {
        throw new Error(`License not found: ${error?.message}`);
      }
      license = data;
    } else if (licenseType) {
      // For free downloads, find license by name
      const { data, error } = await supabaseAdmin
        .from("instrumental_licenses")
        .select("*")
        .ilike("name", licenseType)
        .single();
      
      if (error || !data) {
        throw new Error(`License type '${licenseType}' not found: ${error?.message}`);
      }
      license = data;
    } else {
      throw new Error("Either licenseId or licenseType is required");
    }
    logStep("License found", { name: license.name });

    // Generate unique download token (valid for 7 days)
    const downloadToken = crypto.randomUUID();
    const downloadExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // For free downloads, we need to get user info from the database
    let finalBuyerEmail = buyerEmail;
    let finalBuyerName = buyerName;
    
    if (isFreeDownload && userId) {
      // Get user info from auth.users
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
      
      if (userError) {
        logStep("Error getting user info", userError);
      } else if (userData?.user) {
        finalBuyerEmail = finalBuyerEmail || userData.user.email;
        finalBuyerName = finalBuyerName || userData.user.user_metadata?.full_name || userData.user.email?.split('@')[0] || 'Artiste';
        logStep("User info retrieved", { email: finalBuyerEmail, name: finalBuyerName });
      }
    }

    // Create purchase record
    const purchaseData: any = {
      user_id: userId,
      instrumental_id: instrumentalId,
      license_id: license.id, // Use the license.id we found
      download_token: downloadToken,
      download_expires_at: downloadExpiresAt,
      buyer_email: finalBuyerEmail,
      buyer_name: finalBuyerName
    };

    // Only add payment fields if not a free download
    if (!isFreeDownload) {
      purchaseData.payment_id = paymentId;
      purchaseData.payment_method = paymentMethod;
      purchaseData.amount_paid = amountPaid;
    } else {
      // For free downloads, set explicit values
      purchaseData.payment_id = `free_${downloadToken}`;
      purchaseData.payment_method = "trusted_user_free";
      purchaseData.amount_paid = 0;
    }

    const { error: purchaseError } = await supabaseAdmin
      .from("instrumental_purchases")
      .insert(purchaseData);

    if (purchaseError) {
      throw new Error(`Failed to create purchase: ${purchaseError.message}`);
    }
    logStep("Purchase record created", { downloadToken, isFreeDownload });

    // Generate Google Drive download link
    const driveDownloadUrl = `https://drive.google.com/uc?export=download&id=${instrumental.drive_file_id}`;

    // Also generate a view link for the download page
    const downloadPageUrl = `${req.headers.get("origin")}/download/${downloadToken}`;

    // Check if license includes stems
    const stemsLicenses = ["stems", "premium", "exclusive", "unlimited"];
    const licenseIncludesStems = stemsLicenses.some(s => license.name.toLowerCase().includes(s));
    const hasStemsDriveUrl = instrumental.stems_drive_url && licenseIncludesStems;

    logStep("Download URLs generated", { driveDownloadUrl, downloadPageUrl, hasStemsDriveUrl, stemsDriveUrl: instrumental.stems_drive_url });

    // Send delivery email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);
    const expirationDate = new Date(downloadExpiresAt).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Prepare template variables
    const templateVars: TemplateVariables = {
      client_name: buyerName || 'Artiste',
      client_email: buyerEmail,
      instrumental_title: instrumental.title,
      bpm: instrumental.bpm ? String(instrumental.bpm) : undefined,
      key: instrumental.key,
      license_type: license.name,
      download_link: downloadPageUrl,
      amount_paid: String(amountPaid),
    };

    // Try to use template from database
    const templateResult = await renderEmailHtml("instrumental_delivery", templateVars, {
      extraContent: `
        <div style="background: rgba(0, 212, 255, 0.1); border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 12px; padding: 25px; margin: 16px 0;">
          <h2 style="color: #00d4ff; margin: 0 0 15px 0; font-size: 20px;">📀 ${instrumental.title}</h2>
          <p style="color: #a0a0a0; margin: 0 0 10px 0; font-size: 14px;">
            <strong style="color: #e0e0e0;">Licence :</strong> ${license.name}
          </p>
          ${instrumental.bpm ? `<p style="color: #a0a0a0; margin: 0 0 10px 0; font-size: 14px;"><strong style="color: #e0e0e0;">BPM :</strong> ${instrumental.bpm}</p>` : ''}
          ${instrumental.key ? `<p style="color: #a0a0a0; margin: 0; font-size: 14px;"><strong style="color: #e0e0e0;">Tonalité :</strong> ${instrumental.key}</p>` : ''}
        </div>

        <div style="text-align: center; margin: 20px 0;">
          <a href="${downloadPageUrl}" style="display: inline-block; background: linear-gradient(90deg, #00d4ff 0%, #7c3aed 100%); color: white; text-decoration: none; padding: 18px 40px; border-radius: 50px; font-size: 18px; font-weight: bold; box-shadow: 0 8px 30px rgba(0, 212, 255, 0.4);">
            🎧 Télécharger : ${instrumental.title}
          </a>
        </div>

        <div style="background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 12px; padding: 20px; margin: 20px 0 0 0;">
          <h3 style="color: #ffc107; margin: 0 0 15px 0; font-size: 16px;">💡 Aide au téléchargement</h3>
          <ul style="color: #a0a0a0; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
            <li>Si le téléchargement ne démarre pas immédiatement, patientez quelques secondes.</li>
            <li>En cas de souci, répondez à cet email.</li>
            <li style="color: #ff6b6b;"><strong>Ce lien expire le ${expirationDate}</strong></li>
          </ul>
        </div>
      `,
    });

    let emailSubject: string;
    let emailHtml: string;

    if (templateResult) {
      emailSubject = templateResult.subject;
      emailHtml = templateResult.html;
      logStep("Using database template for instrumental_delivery");
    } else {
      // Fallback to hardcoded template
      logStep("Using fallback template for instrumental_delivery");
      emailSubject = `🎵 Votre Instrumental "${instrumental.title}" est prêt !`;
      emailHtml = `
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
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Votre instrumental est prêt !</p>
    </div>

    <!-- Content -->
    <div style="padding: 40px 30px;">
      <p style="color: #e0e0e0; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Bonjour ${buyerName || 'Artiste'},
      </p>

      <p style="color: #e0e0e0; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
        Merci pour votre achat ! Votre instrumental est maintenant disponible au téléchargement.
      </p>

      <!-- Instrumental Info Box -->
      <div style="background: rgba(0, 212, 255, 0.1); border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 12px; padding: 25px; margin: 0 0 30px 0;">
        <h2 style="color: #00d4ff; margin: 0 0 15px 0; font-size: 20px;">📀 ${instrumental.title}</h2>
        <p style="color: #a0a0a0; margin: 0 0 10px 0; font-size: 14px;">
          <strong style="color: #e0e0e0;">Licence :</strong> ${license.name}
        </p>
        ${instrumental.bpm ? `<p style="color: #a0a0a0; margin: 0 0 10px 0; font-size: 14px;"><strong style="color: #e0e0e0;">BPM :</strong> ${instrumental.bpm}</p>` : ''}
        ${instrumental.key ? `<p style="color: #a0a0a0; margin: 0; font-size: 14px;"><strong style="color: #e0e0e0;">Tonalité :</strong> ${instrumental.key}</p>` : ''}
      </div>

      <!-- Download Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="${downloadPageUrl}" style="display: inline-block; background: linear-gradient(90deg, #00d4ff 0%, #7c3aed 100%); color: white; text-decoration: none; padding: 18px 40px; border-radius: 50px; font-size: 18px; font-weight: bold; box-shadow: 0 8px 30px rgba(0, 212, 255, 0.4);">
          🎧 Télécharger : ${instrumental.title}
        </a>
      </div>

      ${hasStemsDriveUrl ? `
      <!-- Stems Section -->
      <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 25px; margin: 20px 0;">
        <h3 style="color: #22c55e; margin: 0 0 15px 0; font-size: 18px;">🎛️ Stems / Pistes Séparées</h3>
        <p style="color: #a0a0a0; margin: 0 0 15px 0; font-size: 14px;">
          Votre licence <strong style="color: #e0e0e0;">${license.name}</strong> inclut l'accès aux stems (pistes séparées) de cet instrumental.
        </p>
        <div style="text-align: center;">
          <a href="${instrumental.stems_drive_url}" style="display: inline-block; background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 50px; font-size: 16px; font-weight: bold; box-shadow: 0 8px 30px rgba(34, 197, 94, 0.4);">
            📂 Accéder aux Stems sur Google Drive
          </a>
        </div>
        <p style="color: #666; margin: 15px 0 0 0; font-size: 12px; text-align: center;">
          Ce lien vous donne accès permanent au dossier contenant toutes les pistes séparées.
        </p>
      </div>
      ` : ''}

      <!-- Help Section -->
      <div style="background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 12px; padding: 20px; margin: 30px 0 0 0;">
        <h3 style="color: #ffc107; margin: 0 0 15px 0; font-size: 16px;">💡 Aide au téléchargement</h3>
        <ul style="color: #a0a0a0; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
          <li>Si le téléchargement ne démarre pas immédiatement, patientez quelques secondes.</li>
          <li>En cas de souci, répondez à cet email.</li>
          <li style="color: #ff6b6b;"><strong>Ce lien expire le ${expirationDate}</strong></li>
        </ul>
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
    }

    // Only send email if we have an email address
    if (finalBuyerEmail) {
      const { error: emailError } = await resend.emails.send({
        from: "Make Music Studio <noreply@studiomakemusic.com>",
        to: [finalBuyerEmail],
        subject: emailSubject,
        html: emailHtml
      });

      if (emailError) {
        logStep("Email send error", emailError);
        // Don't throw - purchase is still valid
      } else {
        logStep("Delivery email sent successfully");
      }
    } else {
      logStep("No email address available, skipping email");
    }

    return new Response(
      JSON.stringify({
        success: true,
        downloadToken,
        downloadPageUrl,
        downloadUrl: driveDownloadUrl, // Direct download URL for free downloads
        message: "Instrumental delivery initiated"
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
