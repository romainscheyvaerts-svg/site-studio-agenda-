import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-STRIPE-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

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
    
    logStep("Request body received", { amount, email, sessionType, hours });

    if (!amount || !email || !sessionType) {
      throw new Error("Missing required fields: amount, email, sessionType");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    // Check if customer exists
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      // Create new customer
      const customer = await stripe.customers.create({
        email,
        name,
        phone,
      });
      customerId = customer.id;
      logStep("New customer created", { customerId });
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

    const origin = req.headers.get("origin") || "https://b6b6c818-c19e-4ab7-9caf-8f1f698d2e1c.lovableproject.com";

    // Create Checkout session with Apple Pay and Google Pay enabled
    // Stripe Checkout automatically enables Apple Pay and Google Pay when available
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"], // Apple Pay and Google Pay are included with card
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: sessionLabel,
              description: description,
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?payment=cancelled`,
      metadata: {
        sessionType,
        hours: hours?.toString() || "",
        date: date || "",
        time: time || "",
        name: name || "",
        phone: phone || "",
        isDeposit: isDeposit?.toString() || "false",
        totalPrice: totalPrice?.toString() || amount.toString(),
        podcastMinutes: podcastMinutes?.toString() || "",
        message: message || "",
      },
      payment_intent_data: {
        metadata: {
          sessionType,
          hours: hours?.toString() || "",
          date: date || "",
          time: time || "",
          name: name || "",
          phone: phone || "",
          email,
        },
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ 
      url: session.url,
      sessionId: session.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
