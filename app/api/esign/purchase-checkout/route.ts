// app/api/esign/purchase-checkout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY as string;
const ESIGN_PRICE_ID = process.env.STRIPE_ESIGN_PRICE_ID as string; // per-signature price
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20' as any,
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      landlordUserId,
      landlordEmail,
      signatures = 1,
      successUrl,
      cancelUrl,
    } = body as {
      landlordUserId?: string;
      landlordEmail?: string;
      signatures?: number;
      successUrl?: string;
      cancelUrl?: string;
    };

    if (!STRIPE_SECRET_KEY || !ESIGN_PRICE_ID) {
      console.error(
        '[esign checkout] Missing STRIPE_SECRET_KEY or STRIPE_ESIGN_PRICE_ID env var.'
      );
      return NextResponse.json(
        { error: 'Stripe not configured for e-sign.' },
        { status: 500 }
      );
    }

    if (!landlordUserId) {
      return NextResponse.json(
        { error: 'landlordUserId is required.' },
        { status: 400 }
      );
    }

    const qty = Number(signatures);
    if (!qty || qty <= 0 || !Number.isFinite(qty)) {
      return NextResponse.json(
        { error: 'Invalid signatures quantity.' },
        { status: 400 }
      );
    }

    const baseSuccessUrl =
      successUrl ||
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.rentzentro.com'}/landlord/documents?esign=success`;

    const baseCancelUrl =
      cancelUrl ||
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.rentzentro.com'}/landlord/documents?esign=cancelled`;

    // Create Stripe Checkout session for one-time e-sign purchase
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price: ESIGN_PRICE_ID,
          quantity: qty,
        },
      ],
      customer_email: landlordEmail,
      success_url: baseSuccessUrl,
      cancel_url: baseCancelUrl,
      metadata: {
        payment_kind: 'esign',
        landlord_user_id: landlordUserId,
        signatures: String(qty),
        description: `E-signature package: ${qty} signature${
          qty === 1 ? '' : 's'
        }`,
      },
    });

    if (!session.url) {
      console.error('[esign checkout] No URL on created session');
      return NextResponse.json(
        { error: 'Failed to create checkout session.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error('[esign checkout] Unexpected error:', err);
    return NextResponse.json(
      { error: err?.message || 'Unexpected error starting e-sign checkout.' },
      { status: 500 }
    );
  }
}
