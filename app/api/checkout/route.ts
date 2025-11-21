import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  console.error("❌ Missing STRIPE_SECRET_KEY");
}

const stripe = new Stripe(stripeSecret!, {
  apiVersion: '2024-06-20', // REAL stable API version
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, tenantId, propertyId, tenantEmail } = body;

    if (!amount || !tenantId || !propertyId) {
      console.log("❌ Missing checkout body fields:", body);
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    console.log("➡️ Creating Stripe session with:", body);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: tenantEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Rent Payment",
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        tenant_id: String(tenantId),
        property_id: String(propertyId),
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/tenant/payment-success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/tenant/payment-cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("❌ Checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
