// app/api/stripe/subscription-webhook/route.ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Ensure Node runtime for Stripe + env vars
export const runtime = 'nodejs';

// Create Stripe client (no apiVersion so TypeScript stops yelling)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function POST(req: Request) {
  // Read webhook secret at runtime
  const endpointSecret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET;

  if (!endpointSecret) {
    console.error(
      'STRIPE_SUBSCRIPTION_WEBHOOK_SECRET is missing in this environment'
    );
    return NextResponse.json(
      { error: 'Webhook secret not configured.' },
      { status: 500 }
    );
  }

  const sig = headers().get('stripe-signature');

  if (!sig) {
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
    console.error('Stripe webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed.' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      // ------------------------------------------------
      // 1) Checkout session completed (start subscription)
      // ------------------------------------------------
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        const landlordIdStr = session.metadata?.landlordId;
        const customerId = session.customer as string | null;
        const subscriptionId = session.subscription as string | null;

        console.log('checkout.session.completed', {
          landlordIdStr,
          customerId,
          subscriptionId,
        });

        if (!landlordIdStr || !customerId || !subscriptionId) {
          console.warn(
            'Missing landlordId/customerId/subscriptionId on checkout.session.completed'
          );
          break; // still return 200 at bottom
        }

        const landlordId = Number(landlordIdStr);
        if (!Number.isFinite(landlordId)) {
          console.warn('Invalid landlordId in metadata:', landlordIdStr);
          break;
        }

        // Attach Stripe customer + subscription to landlord row
        const { error: updateError } = await supabaseAdmin
          .from('landlords')
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            // status + period end set later by subscription.updated
          })
          .eq('id', landlordId);

        if (updateError) {
          console.error(
            'Error updating landlord on checkout.session.completed:',
            updateError
          );
        }

        break;
      }

      // ------------------------------------------------
      // 2) Subscription updated or deleted
      // ------------------------------------------------
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const status = subscription.status; // 'active', 'past_due', 'canceled', etc.

        // UNIX seconds -> ISO string (or null)
        const currentPeriodEndUnix = (subscription as any)
          .current_period_end as number | null | undefined;

        const currentPeriodEnd =
          typeof currentPeriodEndUnix === 'number' &&
          !Number.isNaN(currentPeriodEndUnix)
            ? new Date(currentPeriodEndUnix * 1000).toISOString()
            : null;

        console.log('subscription event', {
          type: event.type,
          customerId,
          status,
          currentPeriodEndUnix,
          currentPeriodEnd,
        });

        // Find landlord by stripe_customer_id
        const { data: landlord, error: landlordError } = await supabaseAdmin
          .from('landlords')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (landlordError) {
          console.error(
            'Error finding landlord for subscription webhook:',
            landlordError
          );
          break;
        }

        if (!landlord) {
          console.warn(
            'No landlord found for stripe_customer_id in subscription webhook:',
            customerId
          );
          break;
        }

        const { error: updateError } = await supabaseAdmin
          .from('landlords')
          .update({
            stripe_subscription_id: subscription.id,
            subscription_status: status,
            subscription_current_period_end: currentPeriodEnd,
          })
          .eq('id', landlord.id);

        if (updateError) {
          console.error(
            'Error updating landlord subscription fields:',
            updateError
          );
        }

        break;
      }

      default: {
        console.log(`Unhandled Stripe event type: ${event.type}`);
      }
    }

    // Always ack so Stripe stops retrying
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error('Error handling Stripe subscription webhook:', err);
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
