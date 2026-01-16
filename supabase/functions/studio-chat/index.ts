import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20; // 20 requests per minute per IP

function getClientIP(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
         req.headers.get("x-real-ip") || 
         "unknown";
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  record.count++;
  return true;
}

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

// Convert chat messages to Gemini format
interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

function convertToGeminiFormat(messages: ChatMessage[]) {
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  
  for (const msg of messages) {
    // Gemini uses "user" and "model" roles
    const role = msg.role === "assistant" ? "model" : "user";
    contents.push({
      role,
      parts: [{ text: msg.content }]
    });
  }
  
  return contents;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting check
  const clientIP = getClientIP(req);
  if (!checkRateLimit(clientIP)) {
    console.log(`[RATE-LIMIT] IP ${clientIP} exceeded rate limit`);
    return new Response(
      JSON.stringify({ error: "Trop de requêtes. Veuillez patienter une minute." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    console.log("[STUDIO-CHAT] Processing chat request with", messages.length, "messages");

    // Prepend system prompt as first user message for context
    const messagesWithSystem: ChatMessage[] = [
      { role: "user", content: SYSTEM_PROMPT },
      { role: "assistant", content: "Compris ! Je suis prêt à aider les clients du studio. 🎤" },
      ...messages
    ];

    const geminiContents = convertToGeminiFormat(messagesWithSystem);

    // Call Google Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: geminiContents,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[STUDIO-CHAT] Gemini API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessaie dans quelques secondes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    
    // Extract the response text from Gemini's response format
    const assistantMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || 
      "Désolé, je n'ai pas pu traiter ta demande. Réessaie !";

    console.log("[STUDIO-CHAT] Response generated successfully");

    // Return in SSE format for streaming compatibility with frontend
    const sseData = `data: ${JSON.stringify({
      choices: [{
        delta: { content: assistantMessage },
        finish_reason: "stop"
      }]
    })}\n\ndata: [DONE]\n\n`;

    return new Response(sseData, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("[STUDIO-CHAT] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
