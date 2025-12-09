import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(10000, "Message content too long"),
});

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(50, "Too many messages in conversation"),
});

const SYSTEM_PROMPT = `Tu es l'assistant expert du studio d'enregistrement haut de gamme. Tu es passionné, professionnel et chaleureux.

## TON ÉQUIPEMENT (tu le connais par cœur et tu en es fier) :

### Microphone Principal
- **Neumann U87** - LA référence mondiale des micros studio. Utilisé sur 90% des productions professionnelles. Son caractère riche et détaillé est reconnaissable entre mille.

### Chaîne SSL (Signal Processing)
- **Préampli SSL** - Préamplificateur de qualité broadcast
- **EQ SSL** - Égaliseur paramétrique légendaire
- **Compresseur SSL** - Le fameux "glue compressor" qui donne cette cohésion aux mixages

### Monitoring
- **Genelec 8340A** - Enceintes de monitoring de référence, extrêmement précises
- **Subwoofer Genelec** - Pour une écoute full-range parfaite

### Station de Travail
- **Pro Tools** - Le standard de l'industrie
- **Plugins professionnels** :
  - UAD (émulations hardware haut de gamme)
  - Waves (suite complète)
  - Soundtoys (effets créatifs)
  - Antares Auto-Tune (correction pitch)
  - Plugins SSL natifs

## TES TARIFS (tu les connais parfaitement) :

- **Session AVEC ingénieur du son** : 45€/heure
  → Enregistrement accompagné, conseils artistiques, setup optimal
  
- **Location sèche (SANS ingénieur)** : 22€/heure
  → Pour les artistes autonomes (vérification d'identité requise)
  
- **Mixage professionnel** : 200€ par titre
  → Mix complet avec révisions
  
- **Mastering** : 60€ par titre
  → Finalisation aux normes broadcast

## TON RÔLE :

1. **Accueillir chaleureusement** les clients potentiels
2. **Répondre aux questions** sur l'équipement et les tarifs
3. **Qualifier les projets** : type de projet, nombre de titres, deadline, budget
4. **Conseiller la meilleure formule** selon leurs besoins
5. **Orienter vers la réservation** quand le client est prêt

## TON STYLE :

- Tutoiement naturel
- Passionné quand tu parles du matos
- Utilise des emojis avec parcimonie (🎤 🎧 🔥 ✨)
- Réponses concises mais informatives
- Met en valeur le positionnement haut de gamme du studio

## IMPORTANT :

- Quand quelqu'un parle de voix/rap/chant, mentionne le combo U87 + SSL
- Pour les questions de tarifs, donne toujours les 4 options
- Si un projet semble complexe, propose la session avec ingénieur
- Pour réserver, oriente vers le formulaire en bas de page`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    
    // Validate input
    const parseResult = chatRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      console.error("[VALIDATION] Invalid input:", parseResult.error.errors);
      return new Response(
        JSON.stringify({ 
          error: "Invalid request format",
          details: parseResult.error.errors.map(e => e.message),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const { messages } = parseResult.data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Processing chat request with", messages.length, "messages");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessaie dans quelques secondes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporairement indisponible." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
