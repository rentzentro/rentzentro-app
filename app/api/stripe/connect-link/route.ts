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

// StackBlitz forces this preview version; on Vercel you can use a stable version
const stripe = new Stripe(stripeSecret!, {
  apiVersion: '2025-10-29.clover',
});

const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!);

// For now we assume a single landlord with id = 1
const DEFAULT_LANDLORD_ID = 1;

export async function POST(req: NextRequest) {
  try {
    // 1) Load landlord
    const { data: landlord, error: landlordError } = await supabaseAdmin
      .from('landlords')
      .select('id, email, stripe_account_id')
      .eq('id', DEFAULT_LANDLORD_ID)
      .single();

    if (landlordError || !landlord) {
      console.error('❌ Unable to load landlord record:', landlordError);
      return NextResponse.json(
        { error: 'Landlord not found in database.' },
        { status: 500 }
      );
    }

    let accountId = landlord.stripe_account_id as string | null;

    // 2) Create Stripe Connect account if missing
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'standard',
        email: landlord.email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
      });

      accountId = account.id;

      const { error: updateError } = await supabaseAdmin
        .from('landlords')
        .update({ stripe_account_id: accountId })
        .eq('id', DEFAULT_LANDLORD_ID);

      if (updateError) {
        console.error('❌ Failed to save stripe_account_id:', updateError);
        return NextResponse.json(
          { error: 'Failed to store Stripe account id.' },
          { status: 500 }
        );
      }

      console.log('✅ Created Stripe account for landlord:', accountId);
    } else {
      console.log('ℹ️ Landlord already has Stripe account:', accountId);
    }

    // 3) Create onboarding link
    const origin =
      req.headers.get('origin') ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      'http://localhost:3000';

    const accountLink = await stripe.accountLinks.create({
      account: accountId!,
      refresh_url: `${origin}/landlord/payouts?refresh=1`,
      return_url: `${origin}/landlord/payouts?connected=1`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err: any) {
    console.error('❌ Error creating Stripe Connect link:', err);
    return NextResponse.json(
      { error: 'Failed to create Stripe onboarding link.' },
      { status: 500 }
    );
  }
}
