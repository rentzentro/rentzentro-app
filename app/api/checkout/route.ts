// app/api/checkout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20' as any,
});

// Use your live site URL for redirects
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rentzentro.com';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const amount = Number(body.amount);
    const description =
      (body.description as string | undefined) || 'Rent payment';
    const tenantId = body.tenantId as number | null | undefined;
    const propertyId = body.propertyId as number | null | undefined;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid payment amount.' },
        { status: 400 }
      );
    }

    // Amount in cents for Stripe
    const amountInCents = Math.round(amount * 100);

    // 👇 These metadata keys MUST match what webhook expects
    const metadata: Record<string, string> = {
      description,
    };

    if (tenantId != null) metadata.tenantId = String(tenantId);
    if (propertyId != null) metadata.propertyId = String(propertyId);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: amountInCents,
            product_data: {
              name: description,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${SITE_URL}/tenant/payment-success`,
      cancel_url: `${SITE_URL}/tenant/payment-cancelled`,
      metadata,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: 'Stripe session did not return a redirect URL.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error('Error creating Stripe checkout session:', err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          'Unexpected error while creating Stripe checkout session.',
      },
      { status: 500 }
    );
  }
}
