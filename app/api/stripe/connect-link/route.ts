import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// --- Env vars ---
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Log missing envs loudly in the server console
if (!stripeSecret) console.error('❌ STRIPE_SECRET_KEY is missing');
if (!supabaseUrl) console.error('❌ NEXT_PUBLIC_SUPABASE_URL is missing');
if (!supabaseServiceKey) console.error('❌ SUPABASE_SERVICE_ROLE_KEY is missing');

// StackBlitz uses this preview API version type
const stripe = stripeSecret
  ? new Stripe(stripeSecret, {
      apiVersion: '2025-10-29.clover',
    })
  : (null as unknown as Stripe);

const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

// For now we assume a single landlord with id = 1
const DEFAULT_LANDLORD_ID = 1;

export async function POST(req: NextRequest) {
  try {
    // Basic safety checks
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured. Check STRIPE_SECRET_KEY.' },
        { status: 500 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          error:
            'Supabase admin client not configured. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
        },
        { status: 500 }
      );
    }

    // 1) Load landlord
    const {
      data: landlord,
      error: landlordError,
    } = await supabaseAdmin
      .from('landlords')
      .select('id, email, stripe_account_id')
      .eq('id', DEFAULT_LANDLORD_ID)
      .single();

    if (landlordError) {
      console.error('❌ Error loading landlord:', landlordError);
      return NextResponse.json(
        {
          error: `Could not load landlord with id=${DEFAULT_LANDLORD_ID} from Supabase.`,
          detail: landlordError.message ?? landlordError.code,
        },
        { status: 500 }
      );
    }

    if (!landlord) {
      console.error('❌ No landlord row returned');
      return NextResponse.json(
        { error: 'Landlord record not found in database.' },
        { status: 500 }
      );
    }

    let accountId = landlord.stripe_account_id as string | null;

    // 2) Create Stripe Connect account if missing
    if (!accountId) {
      console.log('ℹ️ No stripe_account_id yet, creating Stripe account…');

      let account;
      try {
        account = await stripe.accounts.create({
          type: 'standard',
          email: landlord.email || undefined,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: 'individual',
        });
      } catch (err: any) {
        console.error('❌ Stripe account creation failed:', err);
        return NextResponse.json(
          {
            error:
              'Stripe failed to create a Connect account. Check Stripe dashboard for details.',
            detail: err?.message ?? 'Unknown Stripe error creating account.',
          },
          { status: 500 }
        );
      }

      accountId = account.id;

      const { error: updateError } = await supabaseAdmin
        .from('landlords')
        .update({ stripe_account_id: accountId })
        .eq('id', DEFAULT_LANDLORD_ID);

      if (updateError) {
        console.error('❌ Failed to store stripe_account_id:', updateError);
        return NextResponse.json(
          {
            error:
              'Created Stripe account but failed to store stripe_account_id in Supabase.',
            detail: updateError.message ?? updateError.code,
          },
          { status: 500 }
        );
      }

      console.log('✅ Created Stripe account:', accountId);
    } else {
      console.log('ℹ️ Using existing Stripe account:', accountId);
    }

    // 3) Create onboarding link
    const origin =
      req.headers.get('origin') ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      'http://localhost:3000';

    try {
      const accountLink = await stripe.accountLinks.create({
        account: accountId!,
        refresh_url: `${origin}/landlord/payouts?refresh=1`,
        return_url: `${origin}/landlord/payouts?connected=1`,
        type: 'account_onboarding',
      });

      console.log('✅ Created Stripe account link');
      return NextResponse.json({ url: accountLink.url });
    } catch (err: any) {
      console.error('❌ Stripe accountLinks.create failed:', err);
      return NextResponse.json(
        {
          error:
            'Stripe failed to create an onboarding link. This is often due to the sandbox URL and should work on a real domain (Vercel).',
          detail: err?.message ?? 'Unknown Stripe error creating account link.',
        },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error('❌ Unexpected error in connect-link route:', err);
    return NextResponse.json(
      {
        error: 'Unexpected error in Stripe Connect route.',
        detail: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}
