// app/api/subscription/status/route.ts
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

    // 1) Load landlord row
    const { data: landlord, error: landlordError } = await supabaseAdmin
      .from('landlords')
      .select('id, stripe_customer_id, stripe_subscription_id')
      .eq('id', landlordId)
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
        { error: 'Landlord not found.' },
        { status: 404 }
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
