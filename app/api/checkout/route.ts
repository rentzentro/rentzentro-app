import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(request: Request) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeKey) {
      console.error('❌ STRIPE_SECRET_KEY is missing.');
      return NextResponse.json(
        { error: 'Payment system is not configured. Please contact support.' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2024-06-20',
    });

    const body = await request.json().catch(() => ({}));

    const amount = Number(body.amount);
    const description = body.description || 'Rent payment';
    const tenantId = body.tenantId ? String(body.tenantId) : '';
    const propertyId = body.propertyId ? String(body.propertyId) : '';

    if (!amount || amount <= 0 || Number.isNaN(amount)) {
      console.error('❌ Invalid or missing amount:', amount);
      return NextResponse.json(
        {
          error:
            'Invalid amount provided. Rent may not be set for your account yet.',
        },
        { status: 400 }
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      request.headers.get('origin') ||
      'http://localhost:3000';

    // Stripe uses "amount in cents"
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      billing_address_collection: 'auto',

      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: description,
            },
          },
        },
      ],

      success_url: `${origin}/tenant/payment-success`,
      cancel_url: `${origin}/tenant/payment-cancelled`,

      metadata: {
        tenantId,
        propertyId,
        description,
        rentAmount: String(amount),
      },
    });

    if (!session?.url) {
      console.error('❌ Stripe session missing URL:', session);
      return NextResponse.json(
        {
          error:
            'Unable to start secure payment session. Please contact your landlord.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('❌ Stripe Checkout Error:', err);

    return NextResponse.json(
      {
        error:
          err?.message ||
          'Unexpected error starting payment. Please try again later.',
      },
      { status: 500 }
    );
  }
}
