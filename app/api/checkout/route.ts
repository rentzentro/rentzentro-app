import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripeSecret = process.env.STRIPE_SECRET_KEY;

if (!stripeSecret) {
  console.error('❌ Missing STRIPE_SECRET_KEY');
}

const stripe = new Stripe(stripeSecret!); // ← NO apiVersion override

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, tenantId, propertyId } = body;

    if (!amount || !tenantId || !propertyId) {
      console.log("❌ Missing checkout body fields");
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Rent Payment',
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        tenant_id: tenantId.toString(),
        property_id: propertyId.toString(),
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/tenant/payment-success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/tenant/payment-cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('❌ Stripe checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
