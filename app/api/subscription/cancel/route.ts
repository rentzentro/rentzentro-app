// app/api/subscription/cancel/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20' as any,
});

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { landlordId } = body as { landlordId?: number };

    if (!landlordId) {
      return NextResponse.json(
        { error: 'Missing landlordId in request body.' },
        { status: 400 }
      );
    }

    // 1) Load landlord row
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
        { error: 'Landlord account not found.' },
        { status: 404 }
      );
    }

    const l: any = landlord;

    let subscriptionId: string | null =
      (l.stripe_subscription_id as string | null) || null;
    const customerId: string | null =
      (l.stripe_customer_id as string | null) || null;
    const status: string | null =
      (l.stripe_subscription_status as string | null) || null;

    // 2) Try to resolve an active subscription to cancel
    if (!subscriptionId) {
      // No stored subscription id – try to find one via customer
      if (!customerId) {
        console.warn(
          '[cancel-subscription] No stripe_subscription_id or stripe_customer_id on landlord:',
          l.id
        );
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
        console.warn(
          '[cancel-subscription] No active Stripe subscriptions found for customer:',
          customerId
        );
        return NextResponse.json(
          { error: 'No active subscription to cancel.' },
          { status: 400 }
        );
      }

      subscriptionId = subs.data[0].id;
    } else {
      // We have a subscriptionId — optionally sanity check the status
      if (status && status !== 'active') {
        console.warn(
          '[cancel-subscription] stripe_subscription_id present but status is not active:',
          status
        );
        return NextResponse.json(
          { error: 'No active subscription to cancel.' },
          { status: 400 }
        );
      }
    }

    if (!subscriptionId) {
      // Failsafe – shouldn’t happen if above logic worked
      return NextResponse.json(
        { error: 'No active subscription to cancel.' },
        { status: 400 }
      );
    }

    // 3) Cancel subscription at Stripe
    try {
      await stripe.subscriptions.cancel(subscriptionId);
    } catch (stripeErr: any) {
      // If Stripe says it's already canceled, treat that as success but still update DB
      if (stripeErr?.code !== 'resource_missing') {
        console.error('[cancel-subscription] Stripe cancel error:', stripeErr);
        return NextResponse.json(
          {
            error:
              stripeErr?.message ||
              'Unable to cancel subscription at this time. Please try again.',
          },
          { status: 500 }
        );
      } else {
        console.warn(
          '[cancel-subscription] Subscription already canceled at Stripe, continuing to update DB.'
        );
      }
    }

    // 4) Update landlord row in Supabase
    const updatePayload: Record<string, any> = {
      stripe_subscription_status: 'canceled',
    };

    // If your schema uses these, we try to keep them in sync too:
    if ('stripe_subscription_id' in l) {
      updatePayload['stripe_subscription_id'] = null;
    }
    if ('is_subscribed' in l) {
      updatePayload['is_subscribed'] = false;
    }
    if ('subscription_active' in l) {
      updatePayload['subscription_active'] = false;
    }

    const { error: updateError } = await supabaseAdmin
      .from('landlords')
      .update(updatePayload)
      .eq('id', l.id);

    if (updateError) {
      console.error(
        '[cancel-subscription] Error updating landlord row:',
        updateError
      );
      // still treat cancel as successful, but surface a warning
      return NextResponse.json(
        {
          ok: true,
          warning:
            'Subscription canceled at Stripe, but there was an issue updating your account status. Please contact support.',
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error('[cancel-subscription] Unexpected error:', err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          'Unexpected error while canceling your subscription. Please try again.',
      },
      { status: 500 }
    );
  }
}
