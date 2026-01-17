import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[REGENERATE-DOWNLOAD] ${step}${detailsStr}`);
};

// Generate a secure random token
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    logStep("User authenticated", { userId: user.id, email: user.email });

    const { purchaseId } = await req.json();

    if (!purchaseId) {
      throw new Error("Purchase ID is required");
    }

    // Verify the purchase belongs to the user
    const { data: purchase, error: purchaseError } = await supabase
      .from("instrumental_purchases")
      .select("*")
      .eq("id", purchaseId)
      .single();

    if (purchaseError || !purchase) {
      logStep("Purchase not found", { purchaseId });
      throw new Error("Purchase not found");
    }

    // Check ownership (by user_id or email)
    if (purchase.user_id !== user.id && purchase.buyer_email !== user.email) {
      logStep("Ownership check failed", {
        purchaseUserId: purchase.user_id,
        purchaseEmail: purchase.buyer_email,
        currentUserId: user.id,
        currentEmail: user.email
      });
      throw new Error("You don't have permission to access this purchase");
    }

    logStep("Ownership verified", { purchaseId });

    // Generate new download token and extend expiration (30 days)
    const newToken = generateToken();
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 30);

    const { error: updateError } = await supabase
      .from("instrumental_purchases")
      .update({
        download_token: newToken,
        download_expires_at: newExpiresAt.toISOString(),
      })
      .eq("id", purchaseId);

    if (updateError) {
      logStep("Update error", { error: updateError.message });
      throw new Error("Failed to regenerate download link");
    }

    logStep("Download link regenerated", {
      purchaseId,
      newExpiresAt: newExpiresAt.toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Download link regenerated successfully",
        expiresAt: newExpiresAt.toISOString(),
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
