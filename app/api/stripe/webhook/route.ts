// app/api/stripe/webhook/route.ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20' as any,
});

// Supabase (service role so RLS will NOT block inserts)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const ENDPOINT_SECRET = process.env.STRIPE_WEBHOOK_SECRET as string;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

export async function POST(req: Request) {
  if (!ENDPOINT_SECRET) {
    console.error('Missing STRIPE_WEBHOOK_SECRET env var');
    return NextResponse.json(
      { error: 'Webhook secret not configured.' },
      { status: 500 }
    );
  }

  const headerStore = headers();
  const sig = headerStore.get('stripe-signature');

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
    console.error('Stripe rent webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed.' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // Only handle one-time rent payments, ignore subscriptions
        if (session.mode !== 'payment') {
          console.log(
            '[rent webhook] checkout.session.completed with mode != payment, ignoring'
          );
          break;
        }

        const metadata = (session.metadata || {}) as Record<string, string>;

        // IMPORTANT: keys must match what we send from /api/checkout
        const tenantIdStr = metadata['tenant_id'];
        const propertyIdStr = metadata['property_id'];

        const description =
          metadata['description'] || 'Rent payment';

        if (!tenantIdStr) {
          console.warn(
            '[rent webhook] checkout.session.completed missing tenant_id metadata'
          );
          break;
        }

        const tenant_id = Number(tenantIdStr);
        const property_id =
          propertyIdStr != null && propertyIdStr !== ''
            ? Number(propertyIdStr)
            : null;

        if (Number.isNaN(tenant_id)) {
          console.warn(
            '[rent webhook] Invalid tenant_id in metadata:',
            tenantIdStr
          );
          break;
        }

        if (property_id != null && Number.isNaN(property_id)) {
          console.warn(
            '[rent webhook] Invalid property_id in metadata:',
            propertyIdStr
          );
          break;
        }

        const amountTotal = session.amount_total; // in cents
        if (!amountTotal) {
          console.error(
            '[rent webhook] checkout.session.completed has no amount_total'
          );
          return NextResponse.json(
            { error: 'Missing amount_total on session.' },
            { status: 400 }
          );
        }

        // Store amount as whole dollars (matches your int column)
        const amount = Math.round(amountTotal / 100);

        // Use "today" as paid_on (date only)
        const paid_on = new Date().toISOString().slice(0, 10);

        console.log('[rent webhook] inserting payment row', {
          tenant_id,
          property_id,
          amount,
          paid_on,
          note: description,
        });

        const { error: insertError } = await supabaseAdmin
          .from('payments')
          .insert([
            {
              tenant_id,
              property_id,
              amount,
              paid_on,
              method: 'card',
              note: description,
            },
          ]);

        if (insertError) {
          console.error(
            '[rent webhook] Error inserting payment into payments table:',
            insertError
          );
        }

        break;
      }

      default:
        console.log('[rent webhook] Unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error('[rent webhook] Unexpected error handling event:', err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          'Unexpected error while handling rent webhook event.',
      },
      { status: 500 }
    );
  }
}
