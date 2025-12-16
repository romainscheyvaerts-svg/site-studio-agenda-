import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get purchase by token
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from("instrumental_purchases")
      .select(`
        *,
        instrumental:instrumentals(*),
        license:instrumental_licenses(*)
      `)
      .eq("download_token", token)
      .single();

    if (purchaseError || !purchase) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired download link" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Check if token has expired
    const expiresAt = new Date(purchase.download_expires_at);
    if (expiresAt < new Date()) {
      return new Response(
        JSON.stringify({ error: "Download link has expired", expired: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 410 }
      );
    }

    // Increment download count
    await supabaseAdmin
      .from("instrumental_purchases")
      .update({ download_count: purchase.download_count + 1 })
      .eq("id", purchase.id);

    // Generate direct download URL
    const driveFileId = purchase.instrumental.drive_file_id;
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${driveFileId}`;

    return new Response(
      JSON.stringify({
        success: true,
        instrumental: {
          title: purchase.instrumental.title,
          genre: purchase.instrumental.genre,
          bpm: purchase.instrumental.bpm,
          key: purchase.instrumental.key,
          cover_image_url: purchase.instrumental.cover_image_url
        },
        license: {
          name: purchase.license.name,
          features: purchase.license.features
        },
        downloadUrl,
        expiresAt: purchase.download_expires_at,
        downloadCount: purchase.download_count + 1
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
