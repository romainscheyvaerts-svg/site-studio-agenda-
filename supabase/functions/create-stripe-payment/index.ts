import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // 10 requests per minute per IP

function getClientIP(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
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

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-STRIPE-PAYMENT] ${step}${detailsStr}`);
};

type ServiceKey =
  | "with-engineer"
  | "without-engineer"
  | "mixing"
  | "mastering"
  | "analog-mastering"
  | "podcast";

function computeDiscounted(amount: number, discountPercent: number): number {
  if (!discountPercent || discountPercent <= 0) return amount;
  return Math.round(amount * (1 - discountPercent / 100));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting check
  const clientIP = getClientIP(req);
  if (!checkRateLimit(clientIP)) {
    logStep("Rate limit exceeded", { ip: clientIP });
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const body = await req.json();
    const {
      // amount is accepted for backward compatibility but is NOT trusted
      amount,
      email,
      name,
      phone,
      sessionType,
      hours,
      date,
      time,
      isDeposit,
      totalPrice,
      podcastMinutes,
      message,
    } = body;

    logStep("Request body received", { amount, email, sessionType, hours });

    if (!email || !sessionType) {
      throw new Error("Missing required fields: email, sessionType");
    }

    // ====== SERVER-SIDE PRICE CALC (admin prices + sales) ======
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const serviceKey = sessionType as ServiceKey;

    const [{ data: service, error: serviceErr }, { data: salesCfg }] = await Promise.all([
      supabase
        .from("services")
        .select("service_key, base_price, price_unit")
        .eq("service_key", serviceKey)
        .eq("is_active", true)
        .single(),
      supabase.from("sales_config").select("*").limit(1).maybeSingle(),
    ]);

    if (serviceErr || !service) {
      throw new Error(`Unknown or inactive service: ${serviceKey}`);
    }

    const durationHours = Number(hours || 0);
    const minutes = Number(podcastMinutes || 0);

    // Total before deposit
    let computedTotal = Number(service.base_price);
    if (serviceKey === "podcast") {
      computedTotal = minutes > 0 ? Number(service.base_price) * minutes : Number(service.base_price);
    } else if (service.price_unit === "hourly") {
      computedTotal = durationHours > 0 ? Number(service.base_price) * durationHours : Number(service.base_price);
    }

    // Apply sales (if active)
    let salesPercent = 0;
    if (salesCfg?.is_active) {
      const perService: Record<ServiceKey, number | null | undefined> = {
        "with-engineer": salesCfg.discount_with_engineer,
        "without-engineer": salesCfg.discount_without_engineer,
        mixing: salesCfg.discount_mixing,
        mastering: salesCfg.discount_mastering,
        "analog-mastering": salesCfg.discount_analog_mastering,
        podcast: salesCfg.discount_podcast,
      };
      salesPercent = perService[serviceKey] ?? salesCfg.discount_percentage ?? 0;
    }

    computedTotal = computeDiscounted(computedTotal, salesPercent);

    // Amount to charge now
    let computedCharge = computedTotal;
    const depositRequested = Boolean(isDeposit);
    if (serviceKey === "without-engineer") {
      computedCharge = computedTotal; // full payment
    } else if (serviceKey === "analog-mastering") {
      // Keep existing business rule: fixed 80€ deposit when deposit flow is used
      computedCharge = depositRequested ? Math.min(80, computedTotal) : computedTotal;
    } else {
      computedCharge = depositRequested ? Math.ceil(computedTotal / 2) : computedTotal;
    }

    logStep("Computed pricing", {
      serviceKey,
      base_price: service.base_price,
      price_unit: service.price_unit,
      salesPercent,
      computedTotal,
      computedCharge,
    });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer exists
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      const customer = await stripe.customers.create({ email, name, phone });
      customerId = customer.id;
      logStep("New customer created", { customerId });
    }

    // Build description for the payment
    const sessionLabels: Record<string, string> = {
      "with-engineer": "Session avec ingénieur",
      "without-engineer": "Location sèche",
      mixing: "Mixage",
      mastering: "Mastering",
      "analog-mastering": "Mastering Analogique",
      podcast: "Mixage Podcast",
    };

    const sessionLabel = sessionLabels[serviceKey] || serviceKey;
    let description = `Make Music Studio - ${sessionLabel}`;

    if (serviceKey === "podcast") {
      description += ` (${minutes} min)`;
    } else if (
      durationHours &&
      serviceKey !== "mixing" &&
      serviceKey !== "mastering" &&
      serviceKey !== "analog-mastering"
    ) {
      description += ` (${durationHours}h)`;
    }

    if (date && time) {
      description += ` - ${date} à ${time}`;
    }

    if (depositRequested) {
      description += ` - Acompte`;
    }

    const origin = req.headers.get("origin") || "https://makemusicstudio.be";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: sessionLabel,
              description,
            },
            unit_amount: Math.round(computedCharge * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel`,
      metadata: {
        sessionType: serviceKey,
        hours: durationHours ? String(durationHours) : "",
        date: date || "",
        time: time || "",
        name: name || "",
        phone: phone || "",
        isDeposit: depositRequested ? "true" : "false",
        // authoritative amounts
        totalPrice: String(computedTotal),
        amountCharged: String(computedCharge),
        salesPercent: String(salesPercent || 0),
        podcastMinutes: minutes ? String(minutes) : "",
        message: message || "",
      },
      payment_intent_data: {
        metadata: {
          sessionType: serviceKey,
          hours: durationHours ? String(durationHours) : "",
          date: date || "",
          time: time || "",
          name: name || "",
          phone: phone || "",
          email,
          totalPrice: String(computedTotal),
          amountCharged: String(computedCharge),
        },
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(
      JSON.stringify({
        url: session.url,
        sessionId: session.id,
        computedTotal,
        computedCharge,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
