// app/api/esign/checkout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '../../../supabaseAdminClient';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Price ID for “$2.95 per signature” (or whatever you configured)
const STRIPE_ESIGN_PRICE_ID = process.env.STRIPE_ESIGN_PRICE_ID;

// Base URL for redirecting back into the app
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://www.rentzentro.com';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const { landlordUserId, quantity } = body as {
      landlordUserId?: string;
      quantity?: number;
    };

    // --- validation just for credit purchase ---
    if (!landlordUserId) {
      return NextResponse.json(
        { error: 'Missing landlordUserId for e-sign purchase.' },
        { status: 400 }
      );
    }

    const qty = Number(quantity);
    if (!qty || isNaN(qty) || qty <= 0) {
      return NextResponse.json(
        { error: 'Please enter a valid number of signatures to purchase.' },
        { status: 400 }
      );
    }

    if (!STRIPE_ESIGN_PRICE_ID) {
      return NextResponse.json(
        {
          error:
            'E-sign pricing is not configured yet. Please contact RentZentro support.',
        },
        { status: 500 }
      );
    }

    // Optional sanity check that this landlord exists
    try {
      const { data: landlordRow, error: landlordError } = await supabaseAdmin
        .from('landlords')
        .select('id')
        .eq('user_id', landlordUserId)
        .maybeSingle();

      if (landlordError) {
        console.warn(
          '[esign/checkout] landlord lookup error (continuing anyway):',
          landlordError
        );
      } else if (!landlordRow) {
        console.warn(
          '[esign/checkout] landlord not found for landlordUserId =',
          landlordUserId
        );
      }
    } catch (lookupErr) {
      console.warn('[esign/checkout] landlord lookup threw:', lookupErr);
    }

    // --- Stripe Checkout session for a one-time e-sign credit purchase ---
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price: STRIPE_ESIGN_PRICE_ID,
          quantity: qty,
        },
      ],
      success_url: `${APP_URL}/landlord/documents?esign=success`,
      cancel_url: `${APP_URL}/landlord/documents?esign=cancelled`,
      metadata: {
        type: 'esign_purchase',
        landlord_user_id: landlordUserId,
        signatures: String(qty),
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: 'Unexpected error starting e-sign checkout.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error('[esign/checkout] unexpected error:', err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          'Unexpected error while starting e-sign checkout.',
      },
      { status: 500 }
    );
  }
}
