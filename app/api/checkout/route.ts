import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn('⚠️ STRIPE_SECRET_KEY is not set – Stripe is not fully configured.');
}

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2022-11-15',
    })
  : null;

export async function POST(req: Request) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured yet. Add STRIPE_SECRET_KEY in .env.local.' },
        { status: 500 }
      );
    }

    const body = await req.json();

    const amount = Number(body.amount);
    const description =
      body.description || 'Rent payment via RentZentro (test)';

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid payment amount.' },
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(amount * 100), // dollars → cents
            product_data: {
              name: description,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/tenant/payment-success`,
      cancel_url: `${baseUrl}/tenant/payment-cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe checkout error:', err);
    return NextResponse.json(
      { error: 'Unable to start checkout.' },
      { status: 500 }
    );
  }
}
