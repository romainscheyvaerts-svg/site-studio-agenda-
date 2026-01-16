import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 15; // 15 requests per minute per IP

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
const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(10000),
});

const QuoteAssistantRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(50),
});

type Message = z.infer<typeof MessageSchema>;

// Escape HTML to prevent XSS in emails
const escapeHtml = (str: string) => str
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const SYSTEM_PROMPT = `Tu es l'assistant devis de Make Music Studio, un studio d'enregistrement professionnel à Bruxelles.

TARIFS OFFICIELS :
- Session avec ingénieur : 45€/h (acompte 50%, dès 5h: 40€/h)
- Location sèche (sans ingénieur) : 22€/h (paiement complet, dès 5h: 20€/h)
- Mixage + Mastering : 200€/projet (acompte 50%)
- Mastering digital : 60€/titre (acompte 50%)
- Mastering analogique : 100€/titre (paiement complet)
- Mixage podcast : 40€/minute audio

TON RÔLE :
1. Poser des questions pour comprendre le projet du client (type, nombre de morceaux, durée estimée, besoins spéciaux)
2. Calculer un devis précis basé sur les tarifs officiels
3. Présenter le devis de manière claire et professionnelle
4. Proposer des offres dégressives si applicable

PROCESSUS :
- Pose 2-3 questions maximum pour cerner le projet
- Calcule le devis en détaillant chaque poste
- Termine par "DEVIS_FINAL:" suivi du JSON du devis quand tu as toutes les infos

FORMAT DEVIS FINAL (quand tu as toutes les infos) :
DEVIS_FINAL:{"clientProject":"description courte","items":[{"description":"...","quantity":X,"unitPrice":Y}],"total":Z,"notes":"remarques éventuelles"}

Sois professionnel, chaleureux et précis. Utilise les emojis avec parcimonie (🎵🎤🎧).`;

// Convert chat messages to Gemini format
function convertToGeminiFormat(messages: Message[]) {
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
  if (req.method === "OPTIONS") {
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
    // Parse and validate input
    const rawBody = await req.json();
    const validationResult = QuoteAssistantRequestSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      console.error("[QUOTE-ASSISTANT] Validation error:", validationResult.error.errors);
      return new Response(
        JSON.stringify({ error: "Invalid request data", details: validationResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages } = validationResult.data;
    
    console.log("[QUOTE-ASSISTANT] Processing chat with", messages.length, "messages");

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    // Prepend system prompt as first user message for context
    const messagesWithSystem: Message[] = [
      { role: "user", content: SYSTEM_PROMPT },
      { role: "assistant", content: "Compris ! Je suis prêt à aider les clients avec leurs devis. 🎵" },
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
            maxOutputTokens: 2048,
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
      console.error("[QUOTE-ASSISTANT] Gemini API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Trop de requêtes, veuillez réessayer dans quelques instants." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error("AI service error");
    }

    const data = await response.json();
    const assistantMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || 
      "Désolé, je n'ai pas pu traiter votre demande.";
    
    console.log("[QUOTE-ASSISTANT] Response:", assistantMessage.substring(0, 100));

    // Check if a final quote was generated
    let quoteGenerated = false;
    if (assistantMessage.includes("DEVIS_FINAL:")) {
      quoteGenerated = true;
      
      // Extract quote data and send to studio
      try {
        const quoteMatch = assistantMessage.match(/DEVIS_FINAL:(\{.*\})/s);
        if (quoteMatch) {
          const quoteData = JSON.parse(quoteMatch[1]);
          
          // Send quote to studio email
          const adminEmail = Deno.env.get("ADMIN_EMAIL") || "prod.makemusic@gmail.com";
          const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@studiomakemusic.com";
          
          await resend.emails.send({
            from: `Make Music Studio <${fromEmail}>`,
            to: [adminEmail],
            subject: `🤖 Devis généré par assistant - ${escapeHtml(quoteData.clientProject || "Nouveau projet")}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a1a; color: #fafafa;">
                <h2 style="color: #22d3ee;">Devis généré par l'assistant IA (Gemini)</h2>
                
                <div style="background: #262626; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                  <h3 style="color: #fafafa; margin-top: 0;">Projet : ${escapeHtml(quoteData.clientProject || "")}</h3>
                  
                  <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                    <thead>
                      <tr style="background: #22d3ee; color: #0a0a0a;">
                        <th style="padding: 10px; text-align: left;">Description</th>
                        <th style="padding: 10px; text-align: center;">Qté</th>
                        <th style="padding: 10px; text-align: right;">Prix</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${quoteData.items.map((item: any) => `
                        <tr style="border-bottom: 1px solid #333;">
                          <td style="padding: 10px;">${escapeHtml(String(item.description || ""))}</td>
                          <td style="padding: 10px; text-align: center;">${item.quantity}</td>
                          <td style="padding: 10px; text-align: right;">${(item.quantity * item.unitPrice).toFixed(2)} €</td>
                        </tr>
                      `).join('')}
                      <tr style="background: #333;">
                        <td colspan="2" style="padding: 10px; text-align: right; font-weight: bold;">TOTAL</td>
                        <td style="padding: 10px; text-align: right; font-weight: bold; color: #22d3ee;">${quoteData.total?.toFixed(2) || quoteData.items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0).toFixed(2)} €</td>
                      </tr>
                    </tbody>
                  </table>
                  
                  ${quoteData.notes ? `<p style="margin-top: 15px; color: #a1a1aa;"><strong>Notes :</strong> ${escapeHtml(String(quoteData.notes))}</p>` : ''}
                </div>

                <h3 style="color: #fafafa;">Conversation complète</h3>
                <div style="background: #262626; padding: 20px; border-radius: 8px; max-height: 400px; overflow-y: auto;">
                  ${messages.map((msg: Message) => `
                    <div style="margin-bottom: 15px; padding: 10px; border-radius: 8px; ${msg.role === 'user' ? 'background: #22d3ee; color: #0a0a0a; margin-left: 20%;' : 'background: #333; margin-right: 20%;'}">
                      <strong>${msg.role === 'user' ? 'Client' : 'Assistant'} :</strong><br>
                      ${escapeHtml(msg.content)}
                    </div>
                  `).join('')}
                </div>

                <p style="margin-top: 20px; color: #a1a1aa; font-size: 12px;">
                  Devis généré automatiquement le ${new Date().toLocaleDateString('fr-BE', { 
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

          console.log("[QUOTE-ASSISTANT] Quote sent to studio");
        }
      } catch (parseError) {
        console.error("[QUOTE-ASSISTANT] Error parsing quote:", parseError);
      }
    }

    // Clean up the message for display (remove DEVIS_FINAL JSON)
    const cleanMessage = assistantMessage.replace(/DEVIS_FINAL:\{.*\}/s, "").trim();

    return new Response(
      JSON.stringify({ 
        message: cleanMessage || assistantMessage,
        quoteGenerated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[QUOTE-ASSISTANT] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
