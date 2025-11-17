// app/api/checkout/route.ts
// Stripe Checkout route that uses client-provided URLs and attaches metadata.

export async function POST(req: Request) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe key missing." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as any;

    const rawAmount = body?.amount;
    const successUrl = typeof body?.successUrl === "string" ? body.successUrl : "";
    const cancelUrl = typeof body?.cancelUrl === "string" ? body.cancelUrl : "";

    const tenantId =
      body?.tenantId !== undefined && body?.tenantId !== null
        ? String(body.tenantId)
        : "";
    const propertyId =
      body?.propertyId !== undefined && body?.propertyId !== null
        ? String(body.propertyId)
        : "";
    const description =
      typeof body?.description === "string" && body.description.trim().length > 0
        ? body.description
        : "Rent payment";

    const amount = Number(rawAmount) || 0;

    if (amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid amount." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!successUrl || !cancelUrl) {
      return new Response(
        JSON.stringify({ error: "Missing successUrl or cancelUrl." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const amountInCents = Math.round(amount * 100);

    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("payment_method_types[]", "card");
    params.append("success_url", successUrl);
    params.append("cancel_url", cancelUrl);
    params.append("billing_address_collection", "auto");

    // Line item
    params.append("line_items[0][quantity]", "1");
    params.append("line_items[0][price_data][currency]", "usd");
    params.append(
      "line_items[0][price_data][unit_amount]",
      String(amountInCents)
    );
    params.append(
      "line_items[0][price_data][product_data][name]",
      description
    );

    // Metadata for webhooks
    if (tenantId) params.append("metadata[tenantId]", tenantId);
    if (propertyId) params.append("metadata[propertyId]", propertyId);
    params.append("metadata[description]", description);
    params.append("metadata[rentAmount]", String(amount));

    const stripeRes = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    const session = await stripeRes.json();

    if (!(session as any).url) {
      return new Response(
        JSON.stringify({ error: "Could not create checkout session." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ url: (session as any).url as string }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Checkout error:", err);
    return new Response(JSON.stringify({ error: "Unexpected error." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
