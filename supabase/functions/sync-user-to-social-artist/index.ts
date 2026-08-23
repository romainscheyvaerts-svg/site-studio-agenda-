import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SYNC-TO-SOCIAL-ARTIST] ${step}${d}`);
};

// URL publique du réseau social (page d'accueil)
const SOCIAL_ARTIST_SITE =
  Deno.env.get("SOCIAL_ARTIST_URL") || "https://www.music-artist.art";

// Expéditeur : domaine vérifié dans Resend (celui de Make Music)
const FROM_EMAIL =
  Deno.env.get("SOCIAL_ARTIST_FROM_EMAIL") ||
  "Music Artist <noreply@studiomakemusic.com>";

function welcomeEmailHtml(name: string, loginLink: string | null): string {
  const cta = loginLink || SOCIAL_ARTIST_SITE;
  const greeting = name ? `Salut ${name},` : "Salut,";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#050505;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:20px;padding:40px;border:1px solid rgba(255,255,255,0.1);">

      <div style="text-align:center;margin-bottom:28px;">
        <h1 style="color:#fff;font-size:26px;margin:0;">🎵 Music Artist</h1>
        <p style="color:#a78bfa;font-size:13px;margin:6px 0 0 0;font-weight:600;">Le réseau social des artistes</p>
      </div>

      <div style="background:rgba(255,255,255,0.05);border-radius:14px;padding:28px;margin-bottom:24px;">
        <h2 style="color:#fff;font-size:20px;margin:0 0 12px 0;">${greeting}</h2>
        <p style="color:rgba(255,255,255,0.8);font-size:15px;line-height:1.6;margin:0 0 16px 0;">
          Bonne nouvelle : un compte vient d'être créé pour toi sur
          <strong style="color:#fff;">Music Artist</strong>, le réseau social
          <strong style="color:#fff;">100% dédié aux artistes</strong>.
        </p>
        <p style="color:rgba(255,255,255,0.8);font-size:15px;line-height:1.6;margin:0 0 8px 0;">
          Tu peux dès maintenant :
        </p>
        <ul style="color:rgba(255,255,255,0.8);font-size:15px;line-height:1.8;margin:0;padding-left:20px;">
          <li>🎤 Créer ta <strong style="color:#fff;">page artiste</strong> gratuitement</li>
          <li>📄 Monter ton <strong style="color:#fff;">dossier de presse</strong></li>
          <li>💬 <strong style="color:#fff;">Échanger avec d'autres artistes</strong></li>
          <li>🎶 Présenter ta musique et trouver des collaborations</li>
        </ul>
      </div>

      <div style="text-align:center;margin:8px 0 24px 0;">
        <a href="${cta}" style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;text-decoration:none;padding:16px 36px;border-radius:12px;font-weight:600;font-size:15px;">
          Accéder à mon compte
        </a>
      </div>

      <p style="color:rgba(255,255,255,0.45);font-size:12px;text-align:center;line-height:1.6;margin:0;">
        ${loginLink
          ? `Ce lien de connexion est personnel. S'il a expiré, rends-toi sur <a href="${SOCIAL_ARTIST_SITE}" style="color:#a78bfa;">music-artist.art</a> et connecte-toi avec ton adresse email.`
          : `Rends-toi sur <a href="${SOCIAL_ARTIST_SITE}" style="color:#a78bfa;">music-artist.art</a> et connecte-toi avec ton adresse email.`}
      </p>

      <p style="color:rgba(255,255,255,0.3);font-size:11px;text-align:center;margin-top:26px;">
        Tu reçois cet email car tu t'es inscrit sur Make Music Studio.
      </p>
    </div>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Vérifier l'utilisateur appelant (projet Make Music)
    const mmClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await mmClient.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = userData.user.email?.toLowerCase().trim();
    const name =
      userData.user.user_metadata?.full_name ||
      userData.user.user_metadata?.name ||
      "";
    if (!email) {
      return new Response(JSON.stringify({ error: "No email for user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Client admin du projet Social Artist
    const saUrl = Deno.env.get("SOCIAL_ARTIST_SUPABASE_URL");
    const saKey = Deno.env.get("SOCIAL_ARTIST_SERVICE_ROLE_KEY");
    if (!saUrl || !saKey) {
      log("Social Artist non configuré (secrets manquants)");
      return new Response(
        JSON.stringify({ error: "Social Artist integration not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const saAdmin = createClient(saUrl, saKey, { auth: { persistSession: false } });

    // 3) Créer le compte sur Social Artist (idempotent)
    log("Création du compte Social Artist pour", email);
    const { data: created, error: createError } = await saAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name },
    });

    // Déjà inscrit → ne rien renvoyer par email (idempotence)
    if (createError) {
      const msg = (createError.message || "").toLowerCase();
      const alreadyExists =
        msg.includes("already") ||
        msg.includes("registered") ||
        msg.includes("exists") ||
        (createError as { status?: number }).status === 422;
      if (alreadyExists) {
        log("Compte déjà existant, aucun email envoyé", email);
        return new Response(
          JSON.stringify({ success: true, alreadyExists: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`createUser failed: ${createError.message}`);
    }

    log("Compte créé", { id: created?.user?.id, email });

    // 4) Générer un lien de connexion direct (magic link) — best effort
    let loginLink: string | null = null;
    try {
      const { data: linkData } = await saAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: SOCIAL_ARTIST_SITE },
      });
      loginLink = linkData?.properties?.action_link ?? null;
    } catch (e) {
      log("generateLink échoué (on continue sans lien)", String(e));
    }

    // 5) Email de bienvenue via Resend (clé du projet Make Music)
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      try {
        const resend = new Resend(resendKey);
        await resend.emails.send({
          from: FROM_EMAIL,
          to: [email],
          subject: "🎵 Bienvenue sur Music Artist — ton compte est prêt",
          html: welcomeEmailHtml(name, loginLink),
        });
        log("Email de bienvenue envoyé", email);
      } catch (e) {
        log("Envoi email échoué (compte créé quand même)", String(e));
      }
    } else {
      log("RESEND_API_KEY absente — email non envoyé");
    }

    return new Response(
      JSON.stringify({ success: true, alreadyExists: false, emailSent: !!resendKey }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[SYNC-TO-SOCIAL-ARTIST] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
