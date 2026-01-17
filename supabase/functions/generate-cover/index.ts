import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GENERATE-COVER] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { title, genre, bpm, key: musicalKey, style } = await req.json();

    if (!title && !genre) {
      throw new Error("Title or genre is required");
    }

    // Build a creative prompt for the cover art
    const promptParts = [
      "Album cover art for a music track",
      title ? `titled "${title}"` : "",
      genre ? `in the ${genre} genre` : "",
      bpm ? `at ${bpm} BPM` : "",
      musicalKey ? `in the key of ${musicalKey}` : "",
      style || "modern, abstract, vibrant colors, professional music industry quality",
      "no text, no words, no letters, artistic, high quality, 1:1 aspect ratio"
    ].filter(Boolean).join(", ");

    logStep("Generated prompt", { prompt: promptParts });

    // Use Pollinations.ai - free AI image generation service (no API key required)
    const encodedPrompt = encodeURIComponent(promptParts);
    const seed = Math.floor(Math.random() * 1000000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&seed=${seed}&nologo=true`;

    logStep("Fetching image from Pollinations.ai");

    // Fetch the generated image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to generate image: ${imageResponse.statusText}`);
    }

    const imageBlob = await imageResponse.blob();
    const imageBuffer = await imageBlob.arrayBuffer();

    logStep("Image generated", { size: imageBuffer.byteLength });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedTitle = (title || genre || "cover")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .substring(0, 50);
    const filename = `covers/${sanitizedTitle}-${timestamp}.png`;

    logStep("Uploading to Supabase Storage", { filename });

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("instrumental-covers")
      .upload(filename, imageBuffer, {
        contentType: "image/png",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      logStep("Upload error", { error: uploadError.message });
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    logStep("Upload successful", { path: uploadData.path });

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("instrumental-covers")
      .getPublicUrl(filename);

    const publicUrl = urlData.publicUrl;

    logStep("Cover generated successfully", { url: publicUrl });

    return new Response(
      JSON.stringify({
        success: true,
        coverUrl: publicUrl,
        filename,
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
