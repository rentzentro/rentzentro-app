import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripeSecret = process.env.STRIPE_SECRET_KEY;

export async function POST(req: NextRequest) {
  if (!stripeSecret) {
    console.error('Missing STRIPE_SECRET_KEY');
    return NextResponse.json(
      { error: 'Payment system is not configured.' },
      { status: 500 }
    );
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: '2024-06-20' as any,
  });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const rawAmount = body.amount;
  const amount = Number(rawAmount);
  const description =
    typeof body.description === 'string' && body.description.trim().length > 0
      ? body.description.trim()
      : 'Rent payment';

  if (!amount || isNaN(amount) || amount <= 0) {
    return NextResponse.json(
      { error: 'Invalid amount supplied for payment.' },
      { status: 400 }
    );
  }

  // Figure out our base URL (Vercel / production / local)
  const originHeader = req.headers.get('origin');
  const origin =
    originHeader ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: description },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      // 👇 These must exactly match our Next.js routes below
      success_url: `${origin}/tenant/payment-success`,
      cancel_url: `${origin}/tenant/payment-cancelled`,
      metadata: {
        tenant_id: body.tenantId ? String(body.tenantId) : '',
        property_id: body.propertyId ? String(body.propertyId) : '',
      },
    });

    if (!session.url) {
      console.error('Stripe session created with no URL:', session.id);
      return NextResponse.json(
        { error: 'Stripe session created with no URL.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe Checkout Error:', err);
    return NextResponse.json(
      {
        error:
          err?.message ??
          'Unexpected error creating payment session. Please try again.',
      },
      { status: 500 }
    );
  }
}

export function GET() {
  // When you open /api/checkout in the browser directly, this is expected
  return NextResponse.json({ error: 'Method not allowed.' }, { status: 405 });
}
