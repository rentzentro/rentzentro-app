// app/api/checkout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}

// No apiVersion here so TypeScript stops complaining
const stripe = new Stripe(stripeSecretKey as string);

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { amount, description, tenantId, propertyId } = body as {
      amount?: number;
      description?: string;
      tenantId?: number;
      propertyId?: number | null;
    };

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Missing or invalid amount for payment.' },
        { status: 400 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenantId for payment.' },
        { status: 400 }
      );
    }

    // Create a one-time payment Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: description || 'Rent payment',
            },
            unit_amount: Math.round(amount * 100), // dollars -> cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        tenantId: String(tenantId),
        propertyId: propertyId != null ? String(propertyId) : '',
      },
      success_url: `${APP_URL}/tenant/payment-success`,
      cancel_url: `${APP_URL}/tenant/portal`,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error('Error creating rent checkout session:', err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          'Something went wrong while creating the rent payment session.',
      },
      { status: 500 }
    );
  }
}
