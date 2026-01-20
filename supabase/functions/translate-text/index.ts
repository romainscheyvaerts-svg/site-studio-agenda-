import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple translation dictionary for common studio terms
const TRANSLATION_DICT: Record<string, Record<string, string>> = {
  // Common terms FR -> EN, NL, ES
  "Ingénieur son dédié": {
    en: "Dedicated sound engineer",
    nl: "Toegewijde geluidsingenieur",
    es: "Ingeniero de sonido dedicado"
  },
  "Mix en temps réel": {
    en: "Real-time mixing",
    nl: "Real-time mixing",
    es: "Mezcla en tiempo real"
  },
  "Conseils artistiques": {
    en: "Artistic advice",
    nl: "Artistiek advies",
    es: "Consejos artísticos"
  },
  "Export multipistes": {
    en: "Multitrack export",
    nl: "Multitrack export",
    es: "Exportación multipista"
  },
  "Studio en autonomie": {
    en: "Self-service studio",
    nl: "Studio in autonomie",
    es: "Estudio autónomo"
  },
  "Équipement inclus": {
    en: "Equipment included",
    nl: "Apparatuur inbegrepen",
    es: "Equipo incluido"
  },
  "Accès 24/7 possible": {
    en: "24/7 access possible",
    nl: "24/7 toegang mogelijk",
    es: "Acceso 24/7 posible"
  },
  "Support technique": {
    en: "Technical support",
    nl: "Technische ondersteuning",
    es: "Soporte técnico"
  },
  "Mix professionnel": {
    en: "Professional mix",
    nl: "Professionele mix",
    es: "Mezcla profesional"
  },
  "Mastering inclus (60€)": {
    en: "Mastering included (60€)",
    nl: "Mastering inbegrepen (60€)",
    es: "Mastering incluido (60€)"
  },
  "Révisions incluses": {
    en: "Revisions included",
    nl: "Revisies inbegrepen",
    es: "Revisiones incluidas"
  },
  "Plugins premium": {
    en: "Premium plugins",
    nl: "Premium plugins",
    es: "Plugins premium"
  },
  "Lien Drive envoyé par mail": {
    en: "Drive link sent by email",
    nl: "Drive-link verzonden per e-mail",
    es: "Enlace Drive enviado por correo"
  },
  "Traitement numérique": {
    en: "Digital processing",
    nl: "Digitale verwerking",
    es: "Procesamiento digital"
  },
  "Loudness optimisé": {
    en: "Optimized loudness",
    nl: "Geoptimaliseerde luidheid",
    es: "Volumen optimizado"
  },
  "Format streaming": {
    en: "Streaming format",
    nl: "Streaming formaat",
    es: "Formato streaming"
  },
  "Fichier WAV + MP3": {
    en: "WAV + MP3 files",
    nl: "WAV + MP3 bestanden",
    es: "Archivos WAV + MP3"
  },
  "Console SSL": {
    en: "SSL Console",
    nl: "SSL-console",
    es: "Consola SSL"
  },
  "Couleur analogique": {
    en: "Analog warmth",
    nl: "Analoge kleur",
    es: "Color analógico"
  },
  "Session d'écoute studio": {
    en: "Studio listening session",
    nl: "Studio-luistersessie",
    es: "Sesión de escucha en estudio"
  },
  "Nettoyage audio": {
    en: "Audio cleaning",
    nl: "Audio opschonen",
    es: "Limpieza de audio"
  },
  "Égalisation voix": {
    en: "Voice equalization",
    nl: "Stem equalisatie",
    es: "Ecualización de voz"
  },
  "Montage si nécessaire": {
    en: "Editing if needed",
    nl: "Montage indien nodig",
    es: "Edición si es necesario"
  },
  "Export optimisé podcast": {
    en: "Podcast-optimized export",
    nl: "Podcast-geoptimaliseerde export",
    es: "Exportación optimizada para podcast"
  }
};

// Use Google Translate API if available, otherwise use dictionary
async function translateWithGoogle(text: string, targetLang: string): Promise<string> {
  const googleApiKey = Deno.env.get("GOOGLE_TRANSLATE_API_KEY");

  if (!googleApiKey) {
    return "";
  }

  try {
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${googleApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: text,
          source: "fr",
          target: targetLang,
          format: "text"
        })
      }
    );

    const data = await response.json();
    if (data?.data?.translations?.[0]?.translatedText) {
      return data.data.translations[0].translatedText;
    }
  } catch (error) {
    console.error("Google Translate error:", error);
  }

  return "";
}

// Translate text using dictionary first, then Google API as fallback
async function translateText(text: string, targetLang: string): Promise<string> {
  // Check dictionary first
  const dictEntry = TRANSLATION_DICT[text];
  if (dictEntry && dictEntry[targetLang]) {
    return dictEntry[targetLang];
  }

  // Try Google Translate API
  const googleTranslation = await translateWithGoogle(text, targetLang);
  if (googleTranslation) {
    return googleTranslation;
  }

  // Last resort: return original text
  return text;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin authorization
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .in("role", ["admin", "superadmin"]);

    if (!roleData || roleData.length === 0) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { featureId, featureText } = body;

    if (!featureId || !featureText) {
      return new Response(
        JSON.stringify({ error: "Missing featureId or featureText" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Translate to all languages
    const [textEn, textNl, textEs] = await Promise.all([
      translateText(featureText, "en"),
      translateText(featureText, "nl"),
      translateText(featureText, "es")
    ]);

    // Update the feature with translations
    const { error: updateError } = await supabase
      .from("service_features")
      .update({
        feature_text: featureText,
        feature_text_en: textEn,
        feature_text_nl: textNl,
        feature_text_es: textEs,
        updated_at: new Date().toISOString()
      })
      .eq("id", featureId);

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        translations: {
          fr: featureText,
          en: textEn,
          nl: textNl,
          es: textEs
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
