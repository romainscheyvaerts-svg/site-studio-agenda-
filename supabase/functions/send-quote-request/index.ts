import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { renderEmailHtml, TemplateVariables } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Input validation schema
const QuoteRequestSchema = z.object({
  type: z.literal("email"),
  name: z.string().min(1, "Name is required").max(200, "Name too long").trim(),
  email: z.string().email("Invalid email address").max(255, "Email too long").trim(),
  phone: z.string().max(30, "Phone number too long").optional(),
  projectType: z.string().max(100, "Project type too long").optional(),
  description: z.string().min(1, "Description is required").max(5000, "Description too long").trim(),
});

type QuoteRequest = z.infer<typeof QuoteRequestSchema>;

// Escape HTML to prevent XSS in emails
const escapeHtml = (str: string) => str
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[QUOTE-REQUEST] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const rawBody = await req.json();
    const validationResult = QuoteRequestSchema.safeParse(rawBody);

    if (!validationResult.success) {
      console.error("[QUOTE-REQUEST] Validation error:", validationResult.error.errors);
      return new Response(
        JSON.stringify({ error: "Invalid request data", details: validationResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = validationResult.data;

    logStep("Received quote request from", { name: body.name });

    // Prepare template variables
    const templateVars: TemplateVariables = {
      client_name: body.name,
      client_email: body.email,
      client_phone: body.phone || "Non fourni",
      service_type: body.projectType || "Non spécifié",
      message: body.description,
    };

    // ========== 1. Email to Studio (Admin) ==========
    const adminTemplateResult = await renderEmailHtml("quote_request", templateVars, {
      extraContent: `
        <div style="background: #262626; padding: 20px; border-radius: 8px; margin: 16px 0;">
          <h3 style="color: #fafafa; margin-top: 0;">📋 Informations client</h3>
          <p style="color: #d4d4d8;"><strong>Nom :</strong> ${escapeHtml(body.name)}</p>
          <p style="color: #d4d4d8;"><strong>Email :</strong> <a href="mailto:${escapeHtml(body.email)}" style="color: #22d3ee;">${escapeHtml(body.email)}</a></p>
          ${body.phone ? `<p style="color: #d4d4d8;"><strong>Téléphone :</strong> ${escapeHtml(body.phone)}</p>` : ''}
          ${body.projectType ? `<p style="color: #d4d4d8;"><strong>Type de projet :</strong> ${escapeHtml(body.projectType)}</p>` : ''}
        </div>
        <div style="background: #262626; padding: 20px; border-radius: 8px;">
          <h3 style="color: #fafafa; margin-top: 0;">📝 Description du projet</h3>
          <p style="white-space: pre-wrap; color: #d4d4d8;">${escapeHtml(body.description)}</p>
        </div>
      `,
    });

    let adminSubject: string;
    let adminHtml: string;

    if (adminTemplateResult) {
      adminSubject = adminTemplateResult.subject;
      adminHtml = adminTemplateResult.html;
      logStep("Using database template for quote_request");
    } else {
      // Fallback
      logStep("Using fallback template for quote_request");
      adminSubject = `📋 Nouvelle demande de devis - ${escapeHtml(body.name)}`;
      adminHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a1a; color: #fafafa;">
          <h2 style="color: #22d3ee; margin-bottom: 20px;">Nouvelle demande de devis</h2>

          <div style="background: #262626; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #fafafa; margin-top: 0;">Informations client</h3>
            <p><strong>Nom :</strong> ${escapeHtml(body.name)}</p>
            <p><strong>Email :</strong> <a href="mailto:${escapeHtml(body.email)}" style="color: #22d3ee;">${escapeHtml(body.email)}</a></p>
            ${body.phone ? `<p><strong>Téléphone :</strong> ${escapeHtml(body.phone)}</p>` : ''}
            ${body.projectType ? `<p><strong>Type de projet :</strong> ${escapeHtml(body.projectType)}</p>` : ''}
          </div>

          <div style="background: #262626; padding: 20px; border-radius: 8px;">
            <h3 style="color: #fafafa; margin-top: 0;">Description du projet</h3>
            <p style="white-space: pre-wrap;">${escapeHtml(body.description)}</p>
          </div>

          <p style="margin-top: 20px; color: #a1a1aa; font-size: 12px;">
            Demande reçue le ${new Date().toLocaleDateString('fr-BE', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      `;
    }

    const { error: studioEmailError } = await resend.emails.send({
      from: "Make Music Studio <noreply@studiomakemusic.com>",
      to: ["prod.makemusic@gmail.com"],
      subject: adminSubject,
      html: adminHtml,
    });

    if (studioEmailError) {
      console.error("[QUOTE-REQUEST] Studio email error:", studioEmailError);
      throw studioEmailError;
    }

    // ========== 2. Confirmation to Client ==========
    const clientTemplateResult = await renderEmailHtml("quote_confirmation", templateVars, {
      extraContent: `
        <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 16px 0; border: 1px solid #262626;">
          <h3 style="color: #fafafa; margin-top: 0;">📋 Récapitulatif de votre demande</h3>
          ${body.projectType ? `<p style="color: #d4d4d8;"><strong>Type de projet :</strong> ${escapeHtml(body.projectType)}</p>` : ''}
          <p style="color: #d4d4d8;"><strong>Description :</strong></p>
          <p style="white-space: pre-wrap; color: #a1a1aa;">${escapeHtml(body.description)}</p>
        </div>
      `,
    });

    let clientSubject: string;
    let clientHtml: string;

    if (clientTemplateResult) {
      clientSubject = clientTemplateResult.subject;
      clientHtml = clientTemplateResult.html;
      logStep("Using database template for quote_confirmation");
    } else {
      // Fallback
      logStep("Using fallback template for quote_confirmation");
      clientSubject = "Votre demande de devis - Make Music Studio";
      clientHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #22d3ee;">Merci pour votre demande !</h2>
          <p>Bonjour ${escapeHtml(body.name)},</p>
          <p>Nous avons bien reçu votre demande de devis et nous vous répondrons dans les 24-48 heures.</p>

          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Récapitulatif de votre demande</h3>
            ${body.projectType ? `<p><strong>Type de projet :</strong> ${escapeHtml(body.projectType)}</p>` : ''}
            <p><strong>Description :</strong></p>
            <p style="white-space: pre-wrap;">${escapeHtml(body.description)}</p>
          </div>

          <p>En attendant notre réponse, n'hésitez pas à nous contacter :</p>
          <ul>
            <li>📞 +32 476 09 41 72</li>
            <li>📧 prod.makemusic@gmail.com</li>
          </ul>

          <p style="margin-top: 30px;">À très bientôt au studio !</p>
          <p><strong>L'équipe Make Music</strong></p>

          <hr style="border: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #888; font-size: 12px;">
            Make Music Studio<br>
            Rue du Sceptre 22, 1050 Ixelles, Bruxelles
          </p>
        </div>
      `;
    }

    const { error: clientEmailError } = await resend.emails.send({
      from: "Make Music Studio <noreply@studiomakemusic.com>",
      to: [body.email],
      subject: clientSubject,
      html: clientHtml,
    });

    if (clientEmailError) {
      console.error("[QUOTE-REQUEST] Client email error:", clientEmailError);
      // Don't throw, the main request was successful
    }

    logStep("Quote request processed successfully");

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[QUOTE-REQUEST] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
