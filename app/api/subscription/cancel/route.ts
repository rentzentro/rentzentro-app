// app/api/subscription/cancel/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20' as any,
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

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

    // 1) Load landlord
    const { data: landlord, error: landlordError } = await supabaseAdmin
      .from('landlords')
      .select('*')
      .eq('id', landlordId)
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
        { error: 'Landlord not found.' },
        { status: 404 }
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
        status: 'active',
        limit: 1,
      });

      if (subs.data.length === 0) {
        return NextResponse.json(
          { error: 'No active subscription to cancel.' },
          { status: 400 }
        );
      }

      subscriptionId = subs.data[0].id;
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
