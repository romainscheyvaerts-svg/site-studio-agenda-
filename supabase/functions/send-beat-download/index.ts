import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendBeatDownloadRequest {
  email: string;
  beatName: string;
  downloadUrl: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { email, beatName, downloadUrl }: SendBeatDownloadRequest = await req.json();

    if (!email || !beatName || !downloadUrl) {
      return new Response(
        JSON.stringify({ error: "email, beatName et downloadUrl sont requis" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const emailResponse = await resend.emails.send({
      from: "Make Music <onboarding@resend.dev>",
      to: [email],
      subject: `Votre instru "${beatName}" est prête à être téléchargée`,
      html: `
        <h1>Merci pour votre achat !</h1>
        <p>Voici le lien pour télécharger votre instrumentale <strong>${beatName}</strong> :</p>
        <p><a href="${downloadUrl}" target="_blank">Télécharger l'instru</a></p>
        <p>Conservez ce lien précieusement, il vous permet d'accéder au fichier à tout moment.</p>
        <p>Musicalement,<br/>Make Music Studio</p>
      `,
    });

    console.log("Beat download email sent:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-beat-download function:", error);
    return new Response(
      JSON.stringify({ error: error.message ?? "Erreur interne" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
