import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface QuoteRequest {
  type: "email";
  name: string;
  email: string;
  phone?: string;
  projectType?: string;
  description: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: QuoteRequest = await req.json();
    
    console.log("[QUOTE-REQUEST] Received quote request from:", body.name);

    // Send email to studio
    const { error: studioEmailError } = await resend.emails.send({
      from: "Make Music <onboarding@resend.dev>",
      to: ["prod.makemusic@gmail.com"],
      subject: `📋 Nouvelle demande de devis - ${body.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a1a; color: #fafafa;">
          <h2 style="color: #22d3ee; margin-bottom: 20px;">Nouvelle demande de devis</h2>
          
          <div style="background: #262626; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #fafafa; margin-top: 0;">Informations client</h3>
            <p><strong>Nom :</strong> ${body.name}</p>
            <p><strong>Email :</strong> <a href="mailto:${body.email}" style="color: #22d3ee;">${body.email}</a></p>
            ${body.phone ? `<p><strong>Téléphone :</strong> ${body.phone}</p>` : ''}
            ${body.projectType ? `<p><strong>Type de projet :</strong> ${body.projectType}</p>` : ''}
          </div>

          <div style="background: #262626; padding: 20px; border-radius: 8px;">
            <h3 style="color: #fafafa; margin-top: 0;">Description du projet</h3>
            <p style="white-space: pre-wrap;">${body.description}</p>
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
      `,
    });

    if (studioEmailError) {
      console.error("[QUOTE-REQUEST] Studio email error:", studioEmailError);
      throw studioEmailError;
    }

    // Send confirmation to client
    const { error: clientEmailError } = await resend.emails.send({
      from: "Make Music <onboarding@resend.dev>",
      to: [body.email],
      subject: "Votre demande de devis - Make Music Studio",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #22d3ee;">Merci pour votre demande !</h2>
          <p>Bonjour ${body.name},</p>
          <p>Nous avons bien reçu votre demande de devis et nous vous répondrons dans les 24-48 heures.</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Récapitulatif de votre demande</h3>
            ${body.projectType ? `<p><strong>Type de projet :</strong> ${body.projectType}</p>` : ''}
            <p><strong>Description :</strong></p>
            <p style="white-space: pre-wrap;">${body.description}</p>
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
      `,
    });

    if (clientEmailError) {
      console.error("[QUOTE-REQUEST] Client email error:", clientEmailError);
      // Don't throw, the main request was successful
    }

    console.log("[QUOTE-REQUEST] Quote request processed successfully");

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
