import Stripe from 'stripe';
import { NextResponse } from 'next/server';

// Make sure STRIPE_SECRET_KEY is set in .env
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn('STRIPE_SECRET_KEY is not set in environment variables.');
}

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20', // or the latest supported version
    })
  : null;

export async function POST(req: Request) {
  try {
    if (!stripe || !stripeSecretKey) {
      return NextResponse.json(
        { error: 'Stripe is not configured on the server.' },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const amount = Number(body.amount) || 50; // fallback $50
    const description =
      body.description || 'RentZentro test rent payment';

    // Figure out where to send the user after checkout
    const origin =
      req.headers.get('origin') ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amount * 100, // Stripe uses cents
            product_data: {
              name: description,
            },
          },
        },
      ],
      success_url: `${origin}/tenant/stripe-test?success=1`,
      cancel_url: `${origin}/tenant/stripe-test?canceled=1`,
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
          err?.message ||
          'Failed to create Stripe Checkout session.',
      },
      { status: 500 }
    );
  }
}
