// app/api/esign/purchase-checkout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://www.rentzentro.com';

// Optional: Stripe Price ID for e-sign credits
const ESIGN_PRICE_ID = process.env.STRIPE_ESIGN_PRICE_ID || null;

// PRICE PER SIGNATURE, in cents (used if you don't configure a Price in Stripe)
const FALLBACK_PRICE_CENTS = 295; // $2.95

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const { quantity, landlordUserId } = body as {
      quantity?: number;
      landlordUserId?: string;
    };

    if (!landlordUserId) {
      return NextResponse.json(
        { error: 'Missing landlordUserId for e-sign purchase.' },
        { status: 400 }
      );
    }

    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      return NextResponse.json(
        { error: 'Please choose a valid number of signatures to purchase.' },
        { status: 400 }
      );
    }

    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem =
      ESIGN_PRICE_ID
        ? {
            price: ESIGN_PRICE_ID,
            quantity: qty,
          }
        : {
            quantity: qty,
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'E-signature credits (per signature)',
              },
              unit_amount: FALLBACK_PRICE_CENTS,
            },
          };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [lineItem],
      success_url: `${APP_URL}/landlord/documents?esign=success`,
      cancel_url: `${APP_URL}/landlord/documents?esign=cancelled`,
      metadata: {
        type: 'esign_purchase',
        landlord_user_id: landlordUserId,
        signatures: String(qty),
        description: `E-signature credits x${qty}`,
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: 'Stripe session created without a redirect URL.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error('[esign/purchase-checkout] error:', err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          'Unexpected error while starting the e-sign purchase checkout session.',
      },
      { status: 500 }
    );
  }
}
