import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Input validation schema
const InvoiceItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive().max(1000),
  unitPrice: z.number().min(0).max(100000),
});

const InvoiceRequestSchema = z.object({
  invoiceNumber: z.string().min(1).max(50),
  date: z.string().min(1).max(20),
  dueDate: z.string().max(20).optional(),
  clientName: z.string().min(1).max(200),
  clientEmail: z.string().email().max(255),
  clientAddress: z.string().max(500).optional(),
  items: z.array(InvoiceItemSchema).min(1).max(50),
  notes: z.string().max(2000).optional(),
  sendEmail: z.boolean(),
  // Session details
  sessionType: z.string().max(100).optional(),
  sessionDate: z.string().max(50).optional(),
  sessionStartTime: z.string().max(10).optional(),
  sessionEndTime: z.string().max(10).optional(),
  hours: z.number().positive().max(100).optional(),
  // Payment
  includePaymentLink: z.boolean().optional(),
  stripePaymentUrl: z.string().max(500).optional(),
  // Bank details
  includeBankDetails: z.boolean().optional(),
  bankIban: z.string().max(50).optional(),
  bankBic: z.string().max(20).optional(),
  // Legacy
  totalAmount: z.number().min(0).max(1000000).optional(),
  orderId: z.string().max(100).optional(),
});

type InvoiceRequest = z.infer<typeof InvoiceRequestSchema>;

// Check if user has admin or superadmin role in database
async function isUserAdmin(supabase: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "superadmin"]);
  
  if (error) {
    console.error("[INVOICE] Error checking admin role:", error);
    return false;
  }
  
  return data && data.length > 0;
}

function generateInvoiceHtml(data: InvoiceRequest): string {
  const total = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const formattedDate = new Date(data.date).toLocaleDateString('fr-BE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const formattedDueDate = data.dueDate 
    ? new Date(data.dueDate).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  // Session date formatting
  let formattedSessionDate = '';
  if (data.sessionDate) {
    try {
      formattedSessionDate = new Date(data.sessionDate).toLocaleDateString('fr-BE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      formattedSessionDate = data.sessionDate;
    }
  }

  // Session type label
  const sessionTypeLabels: Record<string, string> = {
    "with-engineer": "Session avec ingénieur son",
    "without-engineer": "Location sèche (autonomie)",
    "mixing": "Mixage",
    "mastering": "Mastering",
    "analog-mastering": "Mastering analogique",
    "podcast": "Mixage podcast",
  };
  const sessionTypeLabel = data.sessionType ? (sessionTypeLabels[data.sessionType] || data.sessionType) : '';

  // Escape HTML to prevent XSS
  const escapeHtml = (str: string) => str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #333; color: #fafafa;">${escapeHtml(item.description)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #333; text-align: center; color: #fafafa;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #333; text-align: right; color: #fafafa;">${item.unitPrice.toFixed(2)} €</td>
      <td style="padding: 12px; border-bottom: 1px solid #333; text-align: right; color: #fafafa;">${(item.quantity * item.unitPrice).toFixed(2)} €</td>
    </tr>
  `).join('');

  // Build session details block
  const hasSessionDetails = data.sessionDate || data.sessionStartTime || data.sessionEndTime || data.hours || sessionTypeLabel;
  const sessionDetailsHtml = hasSessionDetails ? `
    <div style="background: linear-gradient(135deg, rgba(34,211,238,0.1), rgba(124,58,237,0.1)); border: 1px solid rgba(34,211,238,0.3); border-radius: 12px; padding: 20px; margin-bottom: 30px;">
      <h3 style="color: #22d3ee; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px;">📅 Détails de la prestation</h3>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
        ${sessionTypeLabel ? `
        <div>
          <p style="color: #71717a; font-size: 11px; margin: 0 0 4px 0; text-transform: uppercase;">Type de service</p>
          <p style="color: #fafafa; font-size: 14px; margin: 0; font-weight: 600;">${escapeHtml(sessionTypeLabel)}</p>
        </div>
        ` : ''}
        ${formattedSessionDate ? `
        <div>
          <p style="color: #71717a; font-size: 11px; margin: 0 0 4px 0; text-transform: uppercase;">Date de la session</p>
          <p style="color: #fafafa; font-size: 14px; margin: 0; font-weight: 600;">${escapeHtml(formattedSessionDate)}</p>
        </div>
        ` : ''}
        ${data.sessionStartTime && data.sessionEndTime ? `
        <div>
          <p style="color: #71717a; font-size: 11px; margin: 0 0 4px 0; text-transform: uppercase;">Horaire</p>
          <p style="color: #fafafa; font-size: 14px; margin: 0; font-weight: 600;">${escapeHtml(data.sessionStartTime)} - ${escapeHtml(data.sessionEndTime)}</p>
        </div>
        ` : ''}
        ${data.hours ? `
        <div>
          <p style="color: #71717a; font-size: 11px; margin: 0 0 4px 0; text-transform: uppercase;">Durée</p>
          <p style="color: #22d3ee; font-size: 18px; margin: 0; font-weight: 700;">${data.hours}h</p>
        </div>
        ` : ''}
      </div>
    </div>
  ` : '';

  // PAS de bouton de paiement dans la facture HTML (seulement dans l'email)
  const paymentButtonHtml = '';

  // Bank details
  const bankDetailsHtml = data.includeBankDetails && (data.bankIban || data.bankBic) ? `
    <div style="background: #262626; padding: 20px; border-radius: 8px; margin-top: 20px;">
      <h4 style="color: #22d3ee; margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">🏦 Coordonnées bancaires pour virement</h4>
      ${data.bankIban ? `<p style="color: #d4d4d8; font-size: 13px; margin: 6px 0;"><strong>IBAN:</strong> ${escapeHtml(data.bankIban)}</p>` : ''}
      ${data.bankBic ? `<p style="color: #d4d4d8; font-size: 13px; margin: 6px 0;"><strong>BIC:</strong> ${escapeHtml(data.bankBic)}</p>` : ''}
      <p style="color: #71717a; font-size: 11px; margin: 10px 0 0 0;">Référence: ${escapeHtml(data.invoiceNumber)}</p>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Facture ${escapeHtml(data.invoiceNumber)} - Make Music</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; background: #0a0a0a; color: #fafafa; margin: 0; padding: 40px; }
    .invoice-container { max-width: 800px; margin: 0 auto; background: #1a1a1a; border-radius: 16px; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #22d3ee; padding-bottom: 20px; }
    .logo { font-size: 28px; font-weight: 700; color: #22d3ee; }
    .invoice-title { text-align: right; }
    .invoice-title h1 { margin: 0; font-size: 32px; color: #22d3ee; }
    .invoice-title p { margin: 5px 0 0 0; color: #a1a1aa; font-size: 13px; }
    .addresses { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .address-block { flex: 1; }
    .address-block h3 { color: #22d3ee; font-size: 12px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
    .address-block p { margin: 4px 0; color: #d4d4d8; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead th { background: #22d3ee; color: #0a0a0a; padding: 12px; text-align: left; font-weight: 600; font-size: 12px; }
    thead th:nth-child(2), thead th:nth-child(3), thead th:nth-child(4) { text-align: center; }
    thead th:last-child { text-align: right; }
    .total-row { background: #262626; }
    .total-row td { padding: 16px 12px; font-weight: 700; font-size: 18px; }
    .notes { background: #262626; padding: 20px; border-radius: 8px; margin-top: 20px; }
    .notes h4 { margin: 0 0 10px 0; color: #22d3ee; font-size: 13px; }
    .notes p { margin: 0; color: #a1a1aa; font-size: 13px; white-space: pre-wrap; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; }
    .footer p { color: #71717a; font-size: 11px; margin: 4px 0; }
    .legal { background: #1f1f1f; padding: 15px; border-radius: 8px; margin-top: 20px; }
    .legal p { color: #71717a; font-size: 10px; margin: 4px 0; }
    @media print {
      body { background: white; color: black; }
      .invoice-container { background: white; box-shadow: none; }
      .header { border-bottom-color: #22d3ee; }
      thead th { background: #22d3ee !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="logo">MAKE MUSIC 🎵</div>
      <div class="invoice-title">
        <h1>FACTURE</h1>
        <p>N° ${escapeHtml(data.invoiceNumber)}</p>
        <p>Date d'émission : ${formattedDate}</p>
        ${formattedDueDate ? `<p>Date d'échéance : ${formattedDueDate}</p>` : ''}
      </div>
    </div>

    <div class="addresses">
      <div class="address-block">
        <h3>Émetteur</h3>
        <p><strong>Make Music Studio</strong></p>
        <p>Rue du Sceptre 22</p>
        <p>1050 Ixelles, Bruxelles</p>
        <p>Belgique</p>
        <p style="margin-top: 8px;">📧 prod.makemusic@gmail.com</p>
        <p>📞 +32 476 09 41 72</p>
      </div>
      <div class="address-block" style="text-align: right;">
        <h3>Client</h3>
        <p><strong>${escapeHtml(data.clientName)}</strong></p>
        <p>${escapeHtml(data.clientEmail)}</p>
        ${data.clientAddress ? `<p style="margin-top: 8px; white-space: pre-line;">${escapeHtml(data.clientAddress)}</p>` : ''}
      </div>
    </div>

    ${sessionDetailsHtml}

    <table>
      <thead>
        <tr>
          <th style="width: 50%; border-radius: 8px 0 0 0;">Description</th>
          <th style="width: 15%;">Quantité</th>
          <th style="width: 15%;">Prix unitaire</th>
          <th style="width: 20%; border-radius: 0 8px 0 0;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
        <tr class="total-row">
          <td colspan="3" style="text-align: right; padding-right: 20px; color: #fafafa;">TOTAL TTC</td>
          <td style="text-align: right; color: #22d3ee; font-size: 20px;">${total.toFixed(2)} €</td>
        </tr>
      </tbody>
    </table>

    ${paymentButtonHtml}

    ${bankDetailsHtml}

    ${data.notes ? `
    <div class="notes">
      <h4>📝 Notes</h4>
      <p>${escapeHtml(data.notes)}</p>
    </div>
    ` : ''}

    <div class="legal">
      <p><strong>Conditions de paiement:</strong> Paiement à réception de la facture, sauf accord contraire.</p>
      <p><strong>Pénalités de retard:</strong> En cas de retard de paiement, des pénalités de 10% par mois seront appliquées.</p>
      <p>En cas de litige, seuls les tribunaux de Bruxelles sont compétents.</p>
    </div>

    <div class="footer">
      <p><strong>Make Music Studio</strong> - Studio d'enregistrement professionnel</p>
      <p>Rue du Sceptre 22, 1050 Ixelles, Bruxelles, Belgique</p>
      <p>📧 prod.makemusic@gmail.com | 📞 +32 476 09 41 72</p>
      <p style="margin-top: 15px; color: #22d3ee;">Merci pour votre confiance ! 🎵</p>
    </div>
  </div>
</body>
</html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication - only admin can generate invoices
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    console.log("[INVOICE] Auth header present:", !!authHeader);
    
    if (!authHeader) {
      console.error("[INVOICE] No authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    console.log("[INVOICE] Token length:", token.length);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    console.log("[INVOICE] Auth result - user:", user?.email, "error:", authError?.message);
    
    if (authError || !user) {
      console.error("[INVOICE] Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin via database role check (accept both admin and superadmin)
    const hasAdminRole = await isUserAdmin(supabase, user.id);
    
    if (!hasAdminRole) {
      console.error("[INVOICE] Non-admin user attempted to generate invoice:", user.email, user.id);
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("[INVOICE] User has admin role, proceeding...");

    // Parse and validate input
    const rawBody = await req.json();
    const validationResult = InvoiceRequestSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      console.error("[INVOICE] Validation error:", validationResult.error.errors);
      return new Response(
        JSON.stringify({ error: "Invalid request data", details: validationResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = validationResult.data;
    
    console.log("[INVOICE] Generating invoice:", body.invoiceNumber, "by admin:", user.email);

    const invoiceHtml = generateInvoiceHtml(body);
    const totalAmount = body.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0).toFixed(2);

    if (body.sendEmail && body.clientEmail) {
      console.log("[INVOICE] Sending invoice to:", body.clientEmail);
      
      const emailSubject = `Facture ${body.invoiceNumber} - Make Music Studio`;
      
      // Build payment buttons for email - Stripe + PayPal
      const total = parseFloat(totalAmount);
      
      // Only include Stripe link if explicitly provided (dynamically generated via AdminInvoiceGenerator)
      // Do NOT use a hardcoded fallback as it will be invalid/expired
      const stripeLink = body.stripePaymentUrl || null;
      const paypalLink = `https://paypal.me/MakeMusicStudio/${total}EUR`;
      
      // Build Stripe button HTML only if link is provided
      const stripeButtonHtml = stripeLink ? `
        <a href="${stripeLink}" style="display: inline-block; background: linear-gradient(135deg, #635bff, #0a2540); color: #ffffff; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; margin: 5px; box-shadow: 0 4px 12px rgba(99,91,255,0.3);">
          💳 Carte bancaire
        </a>
      ` : '';
      
      const emailPaymentButton = total > 0 ? `
        <div style="text-align: center; margin: 25px 0; padding: 25px; background: linear-gradient(135deg, rgba(34,211,238,0.1), rgba(124,58,237,0.1)); border-radius: 12px; border: 1px solid rgba(34,211,238,0.3);">
          <p style="color: #fafafa; font-size: 15px; margin: 0 0 20px 0; font-weight: 600;">Réglez votre facture en ligne</p>
          
          <div style="display: inline-block;">
            ${stripeButtonHtml}
            
            <!-- Bouton PayPal -->
            <a href="${paypalLink}" style="display: inline-block; background: linear-gradient(135deg, #0070ba, #003087); color: #ffffff; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; margin: 5px; box-shadow: 0 4px 12px rgba(0,112,186,0.3);">
              🅿️ PayPal
            </a>
          </div>
          
          <p style="color: #22d3ee; font-size: 18px; font-weight: 700; margin: 20px 0 5px 0;">${totalAmount} €</p>
          <p style="color: #71717a; font-size: 11px; margin: 0;">Paiement 100% sécurisé</p>
        </div>
      ` : '';
      
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; background: #0a0a0a;">
          <div style="background: #1a1a1a; border-radius: 12px; padding: 30px; border: 1px solid #333;">
            <div style="text-align: center; margin-bottom: 25px;">
              <h1 style="color: #22d3ee; margin: 0;">Make Music Studio 🎵</h1>
              <p style="color: #a1a1aa; margin: 10px 0 0 0;">Votre facture</p>
            </div>
            
            <p style="color: #fafafa; font-size: 15px;">Bonjour <strong>${body.clientName}</strong>,</p>
            <p style="color: #a1a1aa; font-size: 14px;">Veuillez trouver ci-dessous votre facture n° <strong style="color: #22d3ee;">${body.invoiceNumber}</strong>.</p>
            
            <div style="background: #262626; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
              <p style="color: #71717a; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase;">Montant total</p>
              <p style="color: #22d3ee; font-size: 32px; font-weight: 700; margin: 0;">${totalAmount} €</p>
            </div>
            
            ${emailPaymentButton}
            
            <hr style="border: none; border-top: 1px solid #333; margin: 25px 0;">
            
            ${invoiceHtml}
            
            <hr style="border: none; border-top: 1px solid #333; margin: 25px 0;">
            
            <div style="text-align: center;">
              <p style="color: #71717a; font-size: 12px; margin: 0;">
                Make Music Studio<br>
                Rue du Sceptre 22, 1050 Ixelles, Bruxelles<br>
                📧 prod.makemusic@gmail.com | 📞 +32 476 09 41 72
              </p>
            </div>
          </div>
        </div>
      `;
      
      // Send to client
      const { error: emailError } = await resend.emails.send({
        from: "Make Music Studio <noreply@studiomakemusic.com>",
        to: [body.clientEmail],
        subject: emailSubject,
        html: emailHtml,
      });

      if (emailError) {
        console.error("[INVOICE] Email error:", emailError);
        throw emailError;
      }

      console.log("[INVOICE] Email sent to client successfully");
      
      // Send copy to admin (prod.makemusic@gmail.com)
      const adminEmail = "prod.makemusic@gmail.com";
      console.log("[INVOICE] Sending copy to admin:", adminEmail);
      
      const { error: adminEmailError } = await resend.emails.send({
        from: "Make Music Studio <noreply@studiomakemusic.com>",
        to: [adminEmail],
        subject: `[COPIE] ${emailSubject} - Envoyé à ${body.clientEmail}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; background: #0a0a0a;">
            <div style="background: #262626; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #22d3ee;">
              <p style="color: #22d3ee; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">📋 COPIE ADMIN - Facture envoyée</p>
              <p style="color: #a1a1aa; margin: 0; font-size: 13px;">
                <strong>Client:</strong> ${body.clientName} (${body.clientEmail})<br>
                <strong>Montant:</strong> ${totalAmount}€<br>
                <strong>N° Facture:</strong> ${body.invoiceNumber}
                ${body.sessionDate ? `<br><strong>Date session:</strong> ${body.sessionDate}` : ''}
                ${body.hours ? `<br><strong>Durée:</strong> ${body.hours}h` : ''}
              </p>
            </div>
            ${invoiceHtml}
          </div>
        `,
      });

      if (adminEmailError) {
        console.error("[INVOICE] Admin copy email error:", adminEmailError);
        // Don't throw, the main email was sent successfully
      } else {
        console.log("[INVOICE] Admin copy sent successfully");
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        invoiceHtml,
        invoiceNumber: body.invoiceNumber,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[INVOICE] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
