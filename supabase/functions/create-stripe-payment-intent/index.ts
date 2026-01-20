import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { getCorsHeaders } from "../_shared/cors.ts";

// Rate limiting: max 5 requêtes par IP par minute
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting check
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                     req.headers.get("x-real-ip") ||
                     "unknown";

    if (!checkRateLimit(clientIP)) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const body = await req.json();
    const {
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
      message
    } = body;

    if (!amount || !email || !sessionType) {
      throw new Error("Missing required fields: amount, email, sessionType");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    // Check if customer exists
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      // Create new customer
      const customer = await stripe.customers.create({
        email,
        name,
        phone,
      });
      customerId = customer.id;
    }

    // Build description for the payment
    const sessionLabels: Record<string, string> = {
      "with-engineer": "Session avec ingénieur",
      "without-engineer": "Location sèche",
      "mixing": "Mixage",
      "mastering": "Mastering",
      "analog-mastering": "Mastering Analogique",
      "podcast": "Mixage Podcast",
    };

    const sessionLabel = sessionLabels[sessionType] || sessionType;
    let description = `Make Music Studio - ${sessionLabel}`;
    
    if (sessionType === "podcast") {
      description += ` (${podcastMinutes} min)`;
    } else if (hours && sessionType !== "mixing" && sessionType !== "mastering" && sessionType !== "analog-mastering") {
      description += ` (${hours}h)`;
    }
    
    if (date && time) {
      description += ` - ${date} à ${time}`;
    }
    
    if (isDeposit) {
      description += ` - Acompte 50%`;
    }

    // Create PaymentIntent for Apple Pay / Google Pay
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: "eur",
      customer: customerId,
      description,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        sessionType,
        hours: hours?.toString() || "",
        date: date || "",
        time: time || "",
        name: name || "",
        phone: phone || "",
        email,
        isDeposit: isDeposit?.toString() || "false",
        totalPrice: totalPrice?.toString() || amount.toString(),
        podcastMinutes: podcastMinutes?.toString() || "",
        message: message || "",
      },
    });

    return new Response(JSON.stringify({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
