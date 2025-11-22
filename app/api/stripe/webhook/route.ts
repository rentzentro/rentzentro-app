// app/api/stripe/webhook/route.ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Use your secret key – no apiVersion option to avoid TS complaints
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

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
    console.error('Stripe webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed.' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      // Tenant rent payments use Checkout Sessions in "payment" mode
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // If this is a subscription checkout, ignore it here.
        // The /api/stripe/subscription-webhook endpoint handles those.
        if (session.mode === 'subscription') {
          console.log(
            'Ignoring subscription checkout in main webhook (handled by subscription-webhook).'
          );
          break;
        }

        const metadata = session.metadata || {};
        const tenantIdStr = metadata.tenantId;
        const propertyIdStr = metadata.propertyId;

        // If the metadata we rely on is missing, just log & ignore.
        // Returning 200 prevents Stripe from retrying and stops 400 errors.
        if (!tenantIdStr || !propertyIdStr) {
          console.warn(
            'checkout.session.completed received without tenant/property metadata – ignoring.'
          );
          break;
        }

        const tenantId = parseInt(tenantIdStr, 10);
        const propertyId = parseInt(propertyIdStr, 10);

        if (Number.isNaN(tenantId) || Number.isNaN(propertyId)) {
          console.warn(
            'Invalid tenantId/propertyId metadata – ignoring session.',
            { tenantIdStr, propertyIdStr }
          );
          break;
        }

        const amountTotal = session.amount_total ?? 0;
        const amount = amountTotal / 100; // cents → dollars
        const paidOn =
          session.created != null
            ? new Date(session.created * 1000).toISOString()
            : new Date().toISOString();

        console.log('Recording tenant rent payment from webhook', {
          tenantId,
          propertyId,
          amount,
          paidOn,
        });

        const { error: insertError } = await supabaseAdmin.from('payments').insert({
          tenant_id: tenantId,
          property_id: propertyId,
          amount,
          paid_on: paidOn,
          method: 'card',
          note: 'Stripe Checkout rent payment',
        });

        if (insertError) {
          console.error('Error inserting payment record:', insertError);
        }

        break;
      }

      // You can add other payment-related events here if needed
      default: {
        console.log(`Unhandled Stripe event type in main webhook: ${event.type}`);
      }
    }

    // Always ACK so Stripe stops retrying
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error('Error handling Stripe webhook:', err);
    return NextResponse.json(
      { error: err?.message || 'Unexpected error while handling webhook.' },
      { status: 500 }
    );
  }
}
