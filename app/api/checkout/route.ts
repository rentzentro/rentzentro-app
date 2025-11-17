import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// --- Env vars ---
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!stripeSecret) console.error('❌ Missing STRIPE_SECRET_KEY');
if (!supabaseUrl) console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL');
if (!supabaseServiceKey) console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');

// StackBlitz forces this preview API version type
const stripe = new Stripe(stripeSecret!, {
  apiVersion: '2025-10-29.clover',
});

// Admin client so we can read landlords on the server
const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!);

// For now we assume a single landlord with id = 1
const DEFAULT_LANDLORD_ID = 1;

// 2.5% platform fee
const PLATFORM_FEE_PERCENT = 0.025;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null as any);

    if (!body) {
      return NextResponse.json(
        { error: 'Invalid JSON body.' },
        { status: 400 }
      );
    }

    const { amount, description, tenantId, propertyId } = body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Missing or invalid amount.' },
        { status: 400 }
      );
    }

    const dollars = amount;
    const amountInCents = Math.round(dollars * 100);

    const origin =
      req.headers.get('origin') ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      'http://localhost:3000';

    // 1) Load landlord to get stripe_account_id
    const { data: landlord, error: landlordError } = await supabaseAdmin
      .from('landlords')
      .select('id, stripe_account_id')
      .eq('id', DEFAULT_LANDLORD_ID)
      .single();

    if (landlordError || !landlord) {
      console.error('❌ Unable to load landlord record:', landlordError);
      return NextResponse.json(
        { error: 'Landlord not found on server.' },
        { status: 500 }
      );
    }

    const landlordStripeAccountId = landlord.stripe_account_id as
      | string
      | null;

    // 2) Build base Checkout Session params
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: description || 'Rent payment',
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/tenant/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/tenant/cancel`,
      metadata: {
        tenant_id: tenantId ? String(tenantId) : '',
        property_id: propertyId ? String(propertyId) : '',
      },
    };

    // 3) If landlord has a connected Stripe account, set fee + transfer
    if (landlordStripeAccountId) {
      const applicationFeeAmount = Math.round(
        amountInCents * PLATFORM_FEE_PERCENT
      );

      (params as any).payment_intent_data = {
        application_fee_amount: applicationFeeAmount,
        transfer_data: {
          destination: landlordStripeAccountId,
        },
      };

      console.log('💸 Using Connect destination charge with: ', {
        destination: landlordStripeAccountId,
        application_fee_amount: applicationFeeAmount,
        amountInCents,
      });
    } else {
      console.warn(
        '⚠️ No stripe_account_id for landlord; creating session without transfer/fee.'
      );
    }

    // 4) Create the Checkout Session
    const session = await stripe.checkout.sessions.create(params);

    console.log('✅ Created Checkout session:', session.id);

    return NextResponse.json({ id: session.id, url: session.url });
  } catch (err: any) {
    console.error('❌ Error creating checkout session:', err);
    return NextResponse.json(
      { error: 'Failed to create checkout session.' },
      { status: 500 }
    );
  }
}
