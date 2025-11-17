// app/api/checkout/route.ts
// Minimal stable Stripe Checkout route.
// Guaranteed to compile cleanly.

export async function POST(req: Request) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe key missing." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount) || 0;

    if (amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid amount." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const amountInCents = Math.round(amount * 100);

    // Build form data for Stripe
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("payment_method_types[]", "card");
    params.append("success_url", "http://localhost:3000/tenant/payment-success");
    params.append("cancel_url", "http://localhost:3000/tenant/payment-cancelled");
    params.append("line_items[0][quantity]", "1");
    params.append("line_items[0][price_data][currency]", "usd");
    params.append("line_items[0][price_data][unit_amount]", String(amountInCents));
    params.append("line_items[0][price_data][product_data][name]", "Rent Payment");

    // Call Stripe directly
    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();
    if (!session.url) {
      return new Response(JSON.stringify({ error: "Could not create checkout session." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Checkout error:", err);
    return new Response(JSON.stringify({ error: "Unexpected error." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
