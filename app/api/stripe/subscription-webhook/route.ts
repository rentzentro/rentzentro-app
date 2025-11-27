// app/api/stripe/subscription-webhook/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// Helper: update landlord row from a Stripe subscription object
async function updateLandlordFromSubscription(
  customerId: string,
  subscription: Stripe.Subscription,
  contextLabel: string
) {
  const rawStatus = subscription.status;
  // If Stripe says "cancel at period end", store a special status
  const effectiveStatus = subscription.cancel_at_period_end
    ? 'active_cancel_at_period_end'
    : rawStatus;

  // Try to get current_period_end from this subscription
  let currentPeriodEnd: string | null = null;
  let currentPeriodEndUnix =
    (subscription as any).current_period_end as number | null | undefined;

  if (typeof currentPeriodEndUnix === 'number' && !Number.isNaN(currentPeriodEndUnix)) {
    currentPeriodEnd = new Date(currentPeriodEndUnix * 1000).toISOString();
  } else {
    // Backup: fetch fresh subscription from Stripe to see if it has current_period_end
    try {
      const fresh = await stripe.subscriptions.retrieve(subscription.id);
      currentPeriodEndUnix =
        (fresh as any).current_period_end as number | null | undefined;

      if (
        typeof currentPeriodEndUnix === 'number' &&
        !Number.isNaN(currentPeriodEndUnix)
      ) {
        currentPeriodEnd = new Date(currentPeriodEndUnix * 1000).toISOString();
      }
    } catch (err) {
      console.error(
        `[subscription webhook] (${contextLabel}) Error fetching fresh subscription for current_period_end:`,
        err
      );
    }
  }

  console.log(`[subscription webhook] ${contextLabel}`, {
    customerId,
    rawStatus,
    effectiveStatus,
    currentPeriodEndUnix,
    currentPeriodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end,
  });

  const { data: landlord, error: landlordError } = await supabaseAdmin
    .from('landlords')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (landlordError) {
    console.error(
      `[subscription webhook] (${contextLabel}) Error finding landlord:`,
      landlordError
    );
    return;
  }

  if (!landlord) {
    console.warn(
      `[subscription webhook] (${contextLabel}) No landlord found for stripe_customer_id:`,
      customerId
    );
    return;
  }

  // Build update payload – only overwrite period_end if we actually have a value
  const updatePayload: Record<string, any> = {
    stripe_subscription_id: subscription.id,
    subscription_status: effectiveStatus,
  };

  if (currentPeriodEnd) {
    updatePayload.subscription_current_period_end = currentPeriodEnd;
  }

  const { error: updateError } = await supabaseAdmin
    .from('landlords')
    .update(updatePayload)
    .eq('id', landlord.id);

  if (updateError) {
    console.error(
      `[subscription webhook] (${contextLabel}) Error updating landlord:`,
      updateError
    );
  }
}

export async function POST(req: Request) {
  const endpointSecret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET;

  if (!endpointSecret) {
    console.error(
      '[subscription webhook] STRIPE_SUBSCRIPTION_WEBHOOK_SECRET is missing'
    );
    return NextResponse.json(
      { error: 'Webhook secret not configured.' },
      { status: 500 }
    );
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    console.error('[subscription webhook] Missing stripe-signature header');
    return NextResponse.json(
      { error: 'Missing Stripe signature header.' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err: any) {
    console.error(
      '[subscription webhook] Signature verification failed:',
      err?.message || err
    );
    return NextResponse.json(
      { error: 'Webhook signature verification failed.' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      // 1) Checkout session completed – attach customer & subscription IDs
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        const landlordIdStr = session.metadata?.landlordId;
        const customerId = session.customer as string | null;
        const subscriptionId = session.subscription as string | null;

        console.log('[subscription webhook] checkout.session.completed', {
          landlordIdStr,
          customerId,
          subscriptionId,
        });

        if (!landlordIdStr || !customerId || !subscriptionId) {
          console.warn(
            '[subscription webhook] checkout.session.completed missing landlordId/customerId/subscriptionId'
          );
          break;
        }

        const landlordId = Number(landlordIdStr);
        if (!Number.isFinite(landlordId)) {
          console.warn(
            '[subscription webhook] Invalid landlordId in metadata:',
            landlordIdStr
          );
          break;
        }

        const { error: updateError } = await supabaseAdmin
          .from('landlords')
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          })
          .eq('id', landlordId);

        if (updateError) {
          console.error(
            '[subscription webhook] Error updating landlord on checkout.session.completed:',
            updateError
          );
        }

        break;
      }

      // 2) Subscription lifecycle events – set status + period end
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        await updateLandlordFromSubscription(
          customerId,
          subscription,
          event.type
        );
        break;
      }

      default: {
        console.log(
          `[subscription webhook] Unhandled Stripe event type: ${event.type}`
        );
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error('[subscription webhook] Fatal handler error:', err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          'Unexpected error while handling subscription webhook.',
      },
      { status: 500 }
    );
  }
}
