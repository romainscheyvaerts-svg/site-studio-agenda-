import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SessionType = "with-engineer" | "without-engineer" | "mixing" | "mastering" | "analog-mastering" | "podcast" | null;

type PromoEffects = {
  valid: boolean;
  fullCalendarVisibility: boolean;
  skipPayment: boolean;
  skipIdentityVerification: boolean;
  skipFormFields: boolean;
  autoSelectService: SessionType;
  discounts: Record<string, number>;
  customPrices: Record<string, number>;
  requireFullPayment: boolean;
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code } = await req.json();
    
    if (!code || typeof code !== 'string') {
      return new Response(
        JSON.stringify({ valid: false, error: 'Code invalide' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find matching code in database (case-insensitive, must be active)
    const normalizedCode = code.trim().toLowerCase();
    
    const { data: promoData, error: dbError } = await supabase
      .from('promo_codes')
      .select('*')
      .ilike('code', normalizedCode)
      .eq('is_active', true)
      .maybeSingle();

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        JSON.stringify({ valid: false, error: 'Erreur de validation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!promoData) {
      console.log(`Invalid or inactive promo code attempted: ${code}`);
      return new Response(
        JSON.stringify({ valid: false, error: 'Code promo invalide ou inactif' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build discounts object
    const discounts: Record<string, number> = {};
    if (promoData.discount_recording > 0) {
      discounts['with-engineer'] = promoData.discount_recording;
    }
    if (promoData.discount_rental > 0) {
      discounts['without-engineer'] = promoData.discount_rental;
    }
    if (promoData.discount_mixing > 0) {
      discounts['mixing'] = promoData.discount_mixing;
    }
    if (promoData.discount_mastering > 0) {
      discounts['mastering'] = promoData.discount_mastering;
      discounts['analog-mastering'] = promoData.discount_mastering;
    }

    // Build custom prices object
    const customPrices: Record<string, number> = {};
    if (promoData.custom_price_with_engineer !== null) {
      customPrices['with-engineer'] = promoData.custom_price_with_engineer;
    }
    if (promoData.custom_price_without_engineer !== null) {
      customPrices['without-engineer'] = promoData.custom_price_without_engineer;
    }

    // Return only the effects, never the code list
    const effects: PromoEffects = {
      valid: true,
      fullCalendarVisibility: promoData.full_calendar_visibility,
      skipPayment: promoData.skip_payment,
      skipIdentityVerification: promoData.skip_identity_verification,
      skipFormFields: promoData.skip_form_fields,
      autoSelectService: promoData.auto_select_service as SessionType,
      discounts,
      customPrices,
      requireFullPayment: promoData.require_full_payment || false,
    };

    console.log(`Valid promo code applied: ${promoData.code}`);
    return new Response(
      JSON.stringify(effects),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error validating promo code:', error);
    return new Response(
      JSON.stringify({ valid: false, error: 'Erreur serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
