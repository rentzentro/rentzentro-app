// app/api/esign/purchase-checkout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '../../../supabaseAdminClient';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Price in Stripe for *one* e-signature (per signature)
const ESIGN_PRICE_ID = process.env.STRIPE_ESIGN_PRICE_ID;

// Where to send landlord back after Stripe Checkout
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://www.rentzentro.com';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const { quantity, landlordUserId } = body as {
      quantity?: number;
      landlordUserId?: string | null;
    };

    const qty = Number(quantity || 0);

    if (!ESIGN_PRICE_ID) {
      return NextResponse.json(
        {
          error:
            'STRIPE_ESIGN_PRICE_ID is not configured yet. Please contact RentZentro support.',
        },
        { status: 500 }
      );
    }

    if (!qty || qty <= 0) {
      return NextResponse.json(
        { error: 'Please provide a valid number of signatures to purchase.' },
        { status: 400 }
      );
    }

    // Optional sanity check: make sure this landlord exists
    if (landlordUserId) {
      const { data: landlordRow, error: landlordError } = await supabaseAdmin
        .from('landlords')
        .select('id')
        .eq('user_id', landlordUserId)
        .maybeSingle();

      if (landlordError) {
        console.warn(
          '[esign/purchase-checkout] landlord lookup error (continuing anyway):',
          landlordError
        );
      } else if (!landlordRow) {
        console.warn(
          '[esign/purchase-checkout] no landlord row found for landlordUserId =',
          landlordUserId
        );
      }
    }

    // Create Stripe Checkout session. Stripe will charge:
    //   qty × price (which you set to $2.95 per signature in the Dashboard)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price: ESIGN_PRICE_ID,
          quantity: qty, // ✅ THIS is what makes 10 × $2.95 = $29.50
        },
      ],
      success_url: `${APP_URL}/landlord/documents?esign=success`,
      cancel_url: `${APP_URL}/landlord/documents?esign=cancelled`,
      metadata: {
        type: 'esign_purchase',
        landlord_user_id: landlordUserId || '',
        signatures: String(qty),
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
    console.error('[esign/purchase-checkout] unexpected error:', err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          'Unexpected error while starting e-sign purchase checkout.',
      },
      { status: 500 }
    );
  }
}
