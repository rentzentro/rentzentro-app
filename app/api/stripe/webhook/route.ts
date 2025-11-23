// app/api/stripe/webhook/route.ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  // Cast as any to avoid TS complaining if the Stripe type definitions lag
  apiVersion: '2024-06-20' as any,
});

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET as string;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

export async function POST(req: Request) {
  if (!WEBHOOK_SECRET) {
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
    event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
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

        // Only handle one-time rent payments
        if (session.mode !== 'payment') {
          console.log(
            'checkout.session.completed received but mode is not payment, ignoring'
          );
          break;
        }

        const tenantIdStr = session.metadata?.tenantId;
        const propertyIdStr = session.metadata?.propertyId;

        // ✅ Get description from metadata only (TS-safe)
        const description =
          (session.metadata?.description as string | undefined) ||
          'Rent payment';

        if (!tenantIdStr) {
          console.warn(
            'checkout.session.completed (payment) missing tenantId metadata'
          );
          break;
        }

        const tenantId = parseInt(tenantIdStr, 10);
        const propertyId = propertyIdStr ? parseInt(propertyIdStr, 10) : null;

        if (Number.isNaN(tenantId)) {
          console.warn(
            'checkout.session.completed (payment) invalid tenantId metadata:',
            tenantIdStr
          );
          break;
        }

        // Look up tenant to get owner_id (landlord) and fallback property
        const { data: tenantRow, error: tenantError } = await supabaseAdmin
          .from('tenants')
          .select('id, owner_id, property_id')
          .eq('id', tenantId)
          .maybeSingle();

        if (tenantError) {
          console.error(
            'Error loading tenant for Stripe payment webhook:',
            tenantError
          );
          break;
        }

        if (!tenantRow) {
          console.warn(
            'Stripe payment webhook: no tenant found for id:',
            tenantId
          );
          break;
        }

        const ownerId = tenantRow.owner_id;
        const finalPropertyId = propertyId ?? tenantRow.property_id;

        const amountTotalCents = session.amount_total ?? 0;
        const amountDollars = amountTotalCents / 100;

        const paidOnIso = new Date().toISOString();

        const { error: insertError } = await supabaseAdmin
          .from('payments')
          .insert({
            owner_id: ownerId,
            tenant_id: tenantId,
            property_id: finalPropertyId,
            amount: amountDollars,
            paid_on: paidOnIso,
            method: 'Card (Stripe)',
            note: description,
          });

        if (insertError) {
          console.error(
            'Error inserting payment from Stripe webhook:',
            insertError
          );
        } else {
          console.log(
            'Stripe payment recorded:',
            JSON.stringify(
              {
                tenant_id: tenantId,
                property_id: finalPropertyId,
                amount: amountDollars,
              },
              null,
              2
            )
          );
        }

        break;
      }

      default: {
        console.log(`Unhandled Stripe event type in rent webhook: ${event.type}`);
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error('Error handling Stripe rent webhook:', err);
    return NextResponse.json(
      {
        error:
          err?.message || 'Unexpected error while handling Stripe rent webhook.',
      },
      { status: 500 }
    );
  }
}
