// app/api/subscription/status/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from '../../../lib/supabaseEnv';

export const runtime = 'nodejs';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = getSupabaseUrl();
const serviceRoleKey = getSupabaseServiceRoleKey();
const supabaseAnonKey = getSupabaseAnonKey();

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' as any })
  : null;
const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : null;
const supabaseAuth =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export async function POST(req: Request) {
  try {
    if (!stripe || !supabaseAdmin || !supabaseAuth) {
      return NextResponse.json(
        {
          error:
            'Missing STRIPE_SECRET_KEY or Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY), and SUPABASE_SERVICE_ROLE_KEY.',
        },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { landlordId } = body as { landlordId?: number };

    if (landlordId != null && typeof landlordId !== 'number') {
      return NextResponse.json(
        { error: 'Invalid landlordId.' },
        { status: 400 }
      );
    }

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : '';

    if (!token) {
      return NextResponse.json({ error: 'Missing bearer token.' }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const authedUserId = authData.user.id;

    // 1) Load landlord row
    const { data: landlord, error: landlordError } = await supabaseAdmin
      .from('landlords')
      .select('id, user_id, stripe_customer_id, stripe_subscription_id')
      .eq('user_id', authedUserId)
      .maybeSingle();

    if (landlordError) {
      console.error('[subscription-status] landlordError:', landlordError);
      return NextResponse.json(
        { error: 'Unable to load landlord account.' },
        { status: 500 }
      );
    }

    if (!landlord) {
      return NextResponse.json(
        { error: 'Landlord account not found for authenticated user.' },
        { status: 404 }
      );
    }

    if (landlordId != null && landlord.id !== landlordId) {
      return NextResponse.json(
        { error: 'Forbidden: landlordId does not match authenticated account.' },
        { status: 403 }
      );
    }

    let subscriptionId = landlord.stripe_subscription_id as string | null;
    const customerId = landlord.stripe_customer_id as string | null;

    // 2) If we don't have a subscriptionId, look it up from the customer
    if (!subscriptionId) {
      if (!customerId) {
        return NextResponse.json(
          { error: 'No active subscription found.' },
          { status: 400 }
        );
      }

      const subs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 1,
      });

      if (subs.data.length === 0) {
        return NextResponse.json(
          { error: 'No subscriptions found for this account.' },
          { status: 400 }
        );
      }

      subscriptionId = subs.data[0].id;
    }

    // 3) Retrieve the subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    const status = subscription.status;
    const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
    const currentPeriodEndUnix = (subscription as any)
      .current_period_end as number | null | undefined;

    const currentPeriodEnd =
      typeof currentPeriodEndUnix === 'number' && !Number.isNaN(currentPeriodEndUnix)
        ? new Date(currentPeriodEndUnix * 1000).toISOString()
        : null;

    return NextResponse.json(
      {
        status,
        cancel_at_period_end: cancelAtPeriodEnd,
        current_period_end: currentPeriodEnd,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[subscription-status] Unexpected error:', err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          'Unexpected error while loading subscription status.',
      },
      { status: 500 }
    );
  }
}
