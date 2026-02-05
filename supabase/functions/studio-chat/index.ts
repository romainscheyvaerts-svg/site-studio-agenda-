import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 20;

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
  if (record.count >= MAX_REQUESTS_PER_WINDOW) return false;
  record.count++;
  return true;
}

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(10000),
});

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(50),
});

const SYSTEM_PROMPT = `Tu es l'assistant expert du studio d'enregistrement. Tu es passionné, professionnel et chaleureux. 🎤🎧
Tarifs : Session avec ingé 45€/h, Location seule 22€/h, Mix 200€/titre, Master 60€/titre.
Équipement : Neumann U87, SSL, Genelec.`;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

function convertToGeminiFormat(messages: ChatMessage[]) {
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  for (const msg of messages) {
    const role = msg.role === "assistant" ? "model" : "user";
    contents.push({ role, parts: [{ text: msg.content }] });
  }
  return contents;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const clientIP = getClientIP(req);
  if (!checkRateLimit(clientIP)) {
    return new Response(JSON.stringify({ error: "Trop de requêtes." }), { status: 429, headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    const parseResult = chatRequestSchema.safeParse(rawBody);
    if (!parseResult.success) return new Response(JSON.stringify({ error: "Format invalide" }), { status: 400, headers: corsHeaders });
    
    const { messages } = parseResult.data;
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY manquante");

    const messagesWithSystem: ChatMessage[] = [
      { role: "user", content: SYSTEM_PROMPT },
      { role: "assistant", content: "Compris ! Prêt à aider. 🎤" },
      ...messages
    ];

    const geminiContents = convertToGeminiFormat(messagesWithSystem);

    // --- URL ULTRA-STABLE POUR GEMINI AI STUDIO ---
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: geminiContents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[STUDIO-CHAT] Gemini error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erreur IA" }), { status: 500, headers: corsHeaders });
    }

    const data = await response.json();
    const assistantMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || "Désolé, réessaie !";

    const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: assistantMessage }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`;
    return new Response(sseData, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Erreur serveur" }), { status: 500, headers: corsHeaders });
  }
});