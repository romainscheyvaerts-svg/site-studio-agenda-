import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, formName } = await req.json();

    if (!imageBase64) {
      throw new Error("Image is required");
    }

    if (!formName) {
      throw new Error("Form name is required for comparison");
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      throw new Error("API key not configured");
    }

    console.log("Starting identity verification for:", formName);

    // Use Gemini Vision to extract name from ID card
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Tu es un système de vérification d'identité. Analyse cette image de carte d'identité (CNI, passeport, permis de conduire) et extrais UNIQUEMENT le nom et prénom de la personne.

INSTRUCTIONS IMPORTANTES:
- Extrais le NOM DE FAMILLE et le PRÉNOM visibles sur le document
- Ignore les autres informations (date de naissance, adresse, etc.)
- Si tu ne peux pas lire le document clairement, réponds avec "ILLISIBLE"
- Si ce n'est pas un document d'identité valide, réponds avec "INVALIDE"

Réponds UNIQUEMENT avec un JSON dans ce format exact:
{"status": "success", "firstName": "Prénom", "lastName": "Nom"}
ou
{"status": "error", "reason": "ILLISIBLE" ou "INVALIDE"}

Ne rajoute aucun texte avant ou après le JSON.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 200,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", errorText);
      throw new Error("Failed to analyze ID document");
    }

    const aiResult = await response.json();
    const aiMessage = aiResult.choices?.[0]?.message?.content || "";
    
    console.log("AI response:", aiMessage);

    // Parse the AI response
    let extractedData;
    try {
      // Clean the response in case there's extra text
      const jsonMatch = aiMessage.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      extractedData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      return new Response(
        JSON.stringify({
          verified: false,
          error: "Impossible d'analyser le document. Veuillez réessayer avec une photo plus nette.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if document was readable
    if (extractedData.status === "error") {
      return new Response(
        JSON.stringify({
          verified: false,
          error: extractedData.reason === "ILLISIBLE" 
            ? "Le document n'est pas lisible. Veuillez prendre une photo plus nette."
            : "Ce document ne semble pas être une pièce d'identité valide.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Compare names
    const extractedFullName = `${extractedData.firstName} ${extractedData.lastName}`.toLowerCase().trim();
    const formNameNormalized = formName.toLowerCase().trim();
    
    // Normalize names for comparison (remove accents, extra spaces)
    const normalize = (str: string) => {
      return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    };

    const normalizedExtracted = normalize(extractedFullName);
    const normalizedForm = normalize(formNameNormalized);

    // Check for match (both orders: firstName lastName OR lastName firstName)
    const extractedParts = normalizedExtracted.split(" ");
    const formParts = normalizedForm.split(" ");

    let isMatch = false;

    // Check if all parts match (regardless of order)
    if (extractedParts.length >= 2 && formParts.length >= 2) {
      const extractedSet = new Set(extractedParts);
      const formSet = new Set(formParts);
      
      // Check if at least the first and last parts match
      const matchCount = formParts.filter(part => extractedSet.has(part)).length;
      isMatch = matchCount >= 2;
    }

    // Also check direct comparison
    if (!isMatch) {
      isMatch = normalizedExtracted === normalizedForm || 
                normalizedExtracted.includes(normalizedForm) || 
                normalizedForm.includes(normalizedExtracted);
    }

    console.log(`Name comparison: "${normalizedExtracted}" vs "${normalizedForm}" = ${isMatch}`);

    return new Response(
      JSON.stringify({
        verified: isMatch,
        extractedName: `${extractedData.firstName} ${extractedData.lastName}`,
        formName: formName,
        error: isMatch ? null : "Le nom sur le document ne correspond pas au nom du formulaire.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error verifying identity:", errorMessage);
    
    return new Response(
      JSON.stringify({ verified: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
