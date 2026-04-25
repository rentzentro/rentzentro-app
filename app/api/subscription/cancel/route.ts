// app/api/subscription/cancel/route.ts
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
      return NextResponse.json({ error: 'Invalid landlordId.' }, { status: 400 });
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

    // 1) Load landlord
    const { data: landlord, error: landlordError } = await supabaseAdmin
      .from('landlords')
      .select('*')
      .eq('user_id', authedUserId)
      .maybeSingle();

    if (landlordError) {
      console.error('[cancel-subscription] landlordError:', landlordError);
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

    const customerId = landlord.stripe_customer_id as string | null;
    let subscriptionId = landlord.stripe_subscription_id as string | null;

    // 2) If subscriptionId not stored, fetch from Stripe
    if (!subscriptionId) {
      if (!customerId) {
        return NextResponse.json(
          { error: 'No active subscription to cancel.' },
          { status: 400 }
        );
      }

      const subs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 10,
      });

      const cancellable = subs.data.find((sub) => {
        const status = (sub.status || '').toLowerCase();
        return (
          status === 'active' ||
          status === 'trialing' ||
          status === 'past_due' ||
          status === 'unpaid'
        );
      });

      if (!cancellable) {
        return NextResponse.json(
          { error: 'No active subscription to cancel.' },
          { status: 400 }
        );
      }

      subscriptionId = cancellable.id;
    }

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'No active subscription to cancel.' },
        { status: 400 }
      );
    }

    // 3) Schedule cancellation at period end
    let updated;
    try {
      updated = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    } catch (stripeErr: any) {
      console.error('[cancel-subscription] Stripe update error:', stripeErr);
      return NextResponse.json(
        {
          error:
            stripeErr?.message ||
            'Unable to schedule subscription cancellation. Please try again.',
        },
        { status: 500 }
      );
    }

    // TypeScript workaround: Stripe typings are a bit loose here
    const currentPeriodEnd = (updated as any).current_period_end;

    console.log('[cancel-subscription] Scheduled cancel at period end:', {
      subscriptionId: updated.id,
      status: updated.status,
      cancel_at_period_end: updated.cancel_at_period_end,
      current_period_end: currentPeriodEnd,
    });

    // 4) DO NOT update Supabase here.
    // Stripe → webhook → Supabase remains the single source of truth.

    return NextResponse.json(
      {
        ok: true,
        message:
          'Your subscription will remain active until the end of your current billing cycle.',
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[cancel-subscription] Unexpected error:', err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          'Unexpected error while canceling subscription.',
      },
      { status: 500 }
    );
  }
}
