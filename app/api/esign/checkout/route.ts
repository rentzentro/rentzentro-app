// app/api/esign/checkout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20' as any,
});

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const ESIGN_PRICE_CENTS = Number(process.env.ESIGN_PRICE_CENTS || 295); // $2.95 default

function createSupabaseServerClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      signerName,
      signerEmail,
      documentTitle,
    }: {
      signerName?: string;
      signerEmail?: string;
      documentTitle?: string;
    } = body || {};

    if (!signerEmail || !documentTitle) {
      return NextResponse.json(
        {
          error:
            'signerEmail and documentTitle are required to start an e-sign request.',
        },
        { status: 400 }
      );
    }

    const cookieStore = cookies();
    const supabase = createSupabaseServerClient();

    // Auth: landlord (or team member acting as landlord)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(
      cookieStore.get('sb-access-token')?.value
    );

    if (authError || !user?.id || !user.email) {
      console.error('eSign checkout auth error:', authError);
      return NextResponse.json(
        { error: 'You must be logged in as a landlord to use e-sign.' },
        { status: 401 }
      );
    }

    const landlordUserId = user.id;
    const landlordEmail = user.email;

    if (!ESIGN_PRICE_CENTS || ESIGN_PRICE_CENTS <= 0) {
      return NextResponse.json(
        {
          error:
            'ESIGN_PRICE_CENTS is not configured correctly on the server.',
        },
        { status: 500 }
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'http://localhost:3000';

    // 1) Create a row in esign_envelopes with status = checkout_created
    const { data: envelopeRow, error: insertError } = await supabase
      .from('esign_envelopes')
      .insert({
        landlord_user_id: landlordUserId,
        landlord_email: landlordEmail,
        document_title: documentTitle,
        signer_name: signerName || 'Signer',
        signer_email: signerEmail,
        amount_cents: ESIGN_PRICE_CENTS,
        status: 'checkout_created',
      })
      .select('*')
      .single();

    if (insertError || !envelopeRow) {
      console.error('Error inserting esign_envelopes row:', insertError);
      return NextResponse.json(
        { error: 'Failed to start e-sign request. Please try again.' },
        { status: 500 }
      );
    }

    // 2) Create Stripe Checkout for this envelope
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'us_bank_account'],
      customer_email: landlordEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            product_data: {
              name: `E-signature for "${documentTitle}"`,
              description: 'Per-signature e-sign request via RentZentro.',
            },
            unit_amount: ESIGN_PRICE_CENTS,
          },
        },
      ],
      success_url: `${origin}/landlord/documents?esign=success`,
      cancel_url: `${origin}/landlord/documents?esign=cancelled`,
      metadata: {
        payment_kind: 'esign',
        esign_envelope_id: String(envelopeRow.id),
        landlord_user_id: landlordUserId,
        landlord_email: landlordEmail,
        signer_email: signerEmail,
        signer_name: signerName || '',
        document_title: documentTitle,
      },
    });

    // 3) Update row with session id
    const { error: updateError } = await supabase
      .from('esign_envelopes')
      .update({
        stripe_session_id: session.id,
      })
      .eq('id', envelopeRow.id);

    if (updateError) {
      console.error('Error updating esign_envelopes with session id:', updateError);
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error('Error in /api/esign/checkout:', err);
    return NextResponse.json(
      { error: err?.message || 'Unexpected error starting e-sign checkout.' },
      { status: 500 }
    );
  }
}
