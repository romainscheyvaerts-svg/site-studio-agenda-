import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GENERATE-TITLE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { genre, bpm, key: musicalKey, mood, language } = await req.json();

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    // Build prompt for title generation
    const promptParts = [
      "Generate 5 creative and catchy instrumental track titles",
      genre ? `for a ${genre} beat` : "for a hip-hop/trap beat",
      bpm ? `at ${bpm} BPM` : "",
      musicalKey ? `in the key of ${musicalKey}` : "",
      mood ? `with a ${mood} mood/vibe` : "",
      language === "fr" ? "in French" : "in English",
      "",
      "Rules:",
      "- Each title should be 1-4 words maximum",
      "- Titles should be evocative and memorable",
      "- Mix abstract concepts with concrete imagery",
      "- Include the BPM at the end only for 2 of the titles (like 'Title 140 BPM')",
      "- No quotes around the titles",
      "- Return ONLY the 5 titles, one per line, nothing else"
    ].filter(Boolean).join("\n");

    logStep("Calling Gemini API", { genre, bpm, musicalKey });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptParts }] }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 200,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      logStep("Gemini API error", { status: response.status, error: errorData });
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    logStep("Gemini response", { text: textResponse });

    // Parse the titles from the response
    const titles = textResponse
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0 && line.length < 50)
      .slice(0, 5);

    if (titles.length === 0) {
      throw new Error("No valid titles generated");
    }

    logStep("Titles generated", { count: titles.length, titles });

    return new Response(
      JSON.stringify({
        success: true,
        titles,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
