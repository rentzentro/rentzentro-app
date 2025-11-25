// app/landlord/stripe-connect/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// ---------- Supabase (admin) ----------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.'
  );
}

// This client bypasses RLS and is ONLY used on the server
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// ---------- Stripe ----------
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error(
    'Missing STRIPE_SECRET_KEY env var. Set it in your environment before starting the app.'
  );
}

// No apiVersion here – Stripe uses your account’s default
const stripe = new Stripe(stripeSecretKey);

// Base domain for redirect after onboarding
const DOMAIN = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { landlordId } = body as { landlordId?: number };

    if (!landlordId) {
      return NextResponse.json(
        { error: 'Missing landlordId.' },
        { status: 400 }
      );
    }

    // Use admin client so RLS doesn't block reading the landlord row
    const { data: landlord, error: landlordError } = await supabaseAdmin
      .from('landlords')
      .select(
        'id, email, stripe_connect_account_id, stripe_connect_onboarded'
      )
      .eq('id', landlordId)
      .maybeSingle();

    if (landlordError) {
      console.error('Error loading landlord:', landlordError);
      return NextResponse.json(
        { error: 'Unable to load landlord.' },
        { status: 500 }
      );
    }

    if (!landlord) {
      console.error('No landlord row for id:', landlordId);
      return NextResponse.json(
        { error: 'Landlord not found.' },
        { status: 404 }
      );
    }

    let accountId = landlord.stripe_connect_account_id as string | null;

    // If landlord has no Stripe Connect account yet, create one
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: landlord.email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual', // simple default for small landlords
      });

      accountId = account.id;

      // Save Stripe account ID on landlord (admin client, so no RLS issues)
      const { error: updateError } = await supabaseAdmin
        .from('landlords')
        .update({
          stripe_connect_account_id: accountId,
        })
        .eq('id', landlord.id);

      if (updateError) {
        console.error('Error saving Stripe account ID:', updateError);
        // Not fatal; onboarding link will still work
      }
    }

    // Create an onboarding link for payouts setup / management
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${DOMAIN}/landlord/stripe-connect/complete?refresh=1`,
      return_url: `${DOMAIN}/landlord/stripe-connect/complete`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url }, { status: 200 });
  } catch (error: any) {
    console.error('Stripe connect route error:', error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          'Unable to start Stripe payouts setup. Please try again.',
      },
      { status: 500 }
    );
  }
}
