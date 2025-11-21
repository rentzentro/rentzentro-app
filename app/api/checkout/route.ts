import Stripe from 'stripe';
import { NextResponse } from 'next/server';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn('STRIPE_SECRET_KEY is not set in environment variables.');
}

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-11-15',
    })
  : null;

export async function POST(req: Request) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured on the server.' },
        { status: 500 }
      );
    }

    const body = await req.json();

    const {
      amount,
      description,
      tenantId,
      propertyId,
    } = body as {
      amount?: number;
      description?: string;
      tenantId?: number;
      propertyId?: number | null;
    };

    if (!amount || isNaN(amount)) {
      return NextResponse.json(
        { error: 'A valid amount is required to start checkout.' },
        { status: 400 }
      );
    }

    // Base URL for success/cancel
    const origin =
      req.headers.get('origin') ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'http://localhost:3000';

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
            unit_amount: Math.round(amount * 100), // dollars → cents
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/tenant/payment-success`,
      cancel_url: `${origin}/tenant/payment-cancel`,
      metadata: {
        tenantId: tenantId != null ? String(tenantId) : '',
        propertyId: propertyId != null ? String(propertyId) : '',
        // Optional: also store the amount we intended to charge
        intendedAmount: String(amount),
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: 'Stripe did not return a checkout URL.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Error creating Stripe Checkout session:', err);
    return NextResponse.json(
      {
        error:
          err?.message || 'Failed to create Stripe Checkout session.',
      },
      { status: 500 }
    );
  }
}
