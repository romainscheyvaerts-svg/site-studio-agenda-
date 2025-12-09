import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SessionType = "with-engineer" | "without-engineer" | "mixing" | "mastering" | "analog-mastering" | "podcast" | null;

type PromoCodeConfig = {
  code: string;
  fullCalendarVisibility: boolean;
  skipPayment: boolean;
  skipIdentityVerification: boolean;
  skipFormFields: boolean;
  autoSelectService: SessionType;
  discounts: Record<string, number>;
};

type PromoEffects = {
  valid: boolean;
  fullCalendarVisibility: boolean;
  skipPayment: boolean;
  skipIdentityVerification: boolean;
  skipFormFields: boolean;
  autoSelectService: SessionType;
  discounts: Record<string, number>;
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

    // Get promo codes from secrets
    const promoCodesJson = Deno.env.get('PROMO_CODES_CONFIG');
    
    if (!promoCodesJson) {
      console.error('PROMO_CODES_CONFIG secret not configured');
      return new Response(
        JSON.stringify({ valid: false, error: 'Configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let promoCodes: PromoCodeConfig[];
    try {
      promoCodes = JSON.parse(promoCodesJson);
    } catch (e) {
      console.error('Failed to parse PROMO_CODES_CONFIG:', e);
      return new Response(
        JSON.stringify({ valid: false, error: 'Configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find matching code (case-insensitive)
    const normalizedCode = code.trim().toLowerCase();
    const foundPromo = promoCodes.find(p => p.code.toLowerCase() === normalizedCode);

    if (!foundPromo) {
      console.log(`Invalid promo code attempted: ${code}`);
      return new Response(
        JSON.stringify({ valid: false, error: 'Code promo invalide' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return only the effects, never the code list
    const effects: PromoEffects = {
      valid: true,
      fullCalendarVisibility: foundPromo.fullCalendarVisibility,
      skipPayment: foundPromo.skipPayment,
      skipIdentityVerification: foundPromo.skipIdentityVerification,
      skipFormFields: foundPromo.skipFormFields,
      autoSelectService: foundPromo.autoSelectService,
      discounts: foundPromo.discounts,
    };

    console.log(`Valid promo code applied: ${foundPromo.code}`);
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
