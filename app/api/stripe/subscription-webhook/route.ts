import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Stripe client – no apiVersion to keep TS happy
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const ENDPOINT_SECRET = process.env
  .STRIPE_SUBSCRIPTION_WEBHOOK_SECRET as string;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Recommended so Next doesn’t try to cache this route
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!ENDPOINT_SECRET) {
    console.error('Missing STRIPE_SUBSCRIPTION_WEBHOOK_SECRET');
    return NextResponse.json(
      { error: 'Webhook not configured.' },
      { status: 500 }
    );
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json(
      { error: 'Missing Stripe signature header.' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, ENDPOINT_SECRET);
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid Stripe webhook signature.' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const status = subscription.status; // 'active', 'past_due', 'canceled', etc.

        // ----- current_period_end handling (fix for red underline) -----
        // Access via `any` so TS stops complaining, then validate manually.
        const rawCurrentPeriodEnd = (subscription as any).current_period_end;
        const currentPeriodEndUnix =
          typeof rawCurrentPeriodEnd === 'number' ? rawCurrentPeriodEnd : null;

        const currentPeriodEnd =
          currentPeriodEndUnix && !Number.isNaN(currentPeriodEndUnix)
            ? new Date(currentPeriodEndUnix * 1000).toISOString()
            : null;
        // ---------------------------------------------------------------

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
        // Ignore other Stripe events for now
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error('Error handling subscription webhook:', err);
    return NextResponse.json(
      { error: err?.message || 'Webhook handler error.' },
      { status: 500 }
    );
  }
}
