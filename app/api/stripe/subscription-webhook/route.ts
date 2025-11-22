import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// ---------- Stripe & Supabase Setup ----------

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string); // no apiVersion – use dashboard version

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Set this env in Stripe webhook: STRIPE_SUBSCRIPTION_WEBHOOK_SECRET=whsec_xxx
const endpointSecret = process.env
  .STRIPE_SUBSCRIPTION_WEBHOOK_SECRET as string;

// ---------- Route Handler ----------

export async function POST(req: Request) {
  const body = await req.text();
  const sig = (await headers()).get('stripe-signature');

  if (!sig || !endpointSecret) {
    console.error('Missing stripe-signature or webhook secret');
    return new NextResponse('Unauthorized', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error('Stripe webhook signature error:', err?.message);
    return new NextResponse(`Webhook Error: ${err?.message}`, {
      status: 400,
    });
  }

  try {
    switch (event.type) {
      // ------------------------------
      // When checkout session completes
      // ------------------------------
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode !== 'subscription') break;

        const customerId = session.customer as string | null;
        const subscriptionId = session.subscription as string | null;

        if (!customerId || !subscriptionId) break;

        // we might also have landlordId in metadata if you set it that way
        const landlordIdFromMeta = session.metadata?.landlordId;

        if (landlordIdFromMeta) {
          // If we stored landlordId in metadata, update by id
          await supabaseAdmin
            .from('landlords')
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              subscription_status: 'active',
            })
            .eq('id', Number(landlordIdFromMeta));
        } else {
          // Otherwise, update by stripe_customer_id
          await supabaseAdmin
            .from('landlords')
            .update({
              stripe_subscription_id: subscriptionId,
              subscription_status: 'active',
            })
            .eq('stripe_customer_id', customerId);
        }

        break;
      }

      // ------------------------------
      // Subscription updated or deleted
      // ------------------------------
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        const customerId = subscription.customer as string;
        const status = subscription.status; // active, past_due, canceled, etc.

        // NOTE: we're using "as any" here because TS types are being annoying.
        const rawCurrentPeriodEnd =
          (subscription as any).current_period_end as
            | number
            | null
            | undefined;

        const currentPeriodEnd =
          typeof rawCurrentPeriodEnd === 'number' && !isNaN(rawCurrentPeriodEnd)
            ? new Date(rawCurrentPeriodEnd * 1000).toISOString()
            : null;

        // Find landlord by stripe_customer_id
        const { data: landlord, error: landlordError } = await supabaseAdmin
          .from('landlords')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (!landlordError && landlord) {
          await supabaseAdmin
            .from('landlords')
            .update({
              stripe_subscription_id: subscription.id,
              subscription_status: status,
              subscription_current_period_end: currentPeriodEnd,
            })
            .eq('id', landlord.id);
        }

        break;
      }

      default:
        // ignore everything else for now
        break;
    }

    return new NextResponse('OK', { status: 200 });
  } catch (err: any) {
    console.error('Stripe subscription webhook handler error:', err);
    return new NextResponse('Webhook handler failed', { status: 500 });
  }
}
