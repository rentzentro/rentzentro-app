// app/api/stripe/webhook/route.ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20' as any,
});

// Supabase admin (RLS bypass)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const ENDPOINT_SECRET = process.env.STRIPE_WEBHOOK_SECRET as string;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Logging helper
function log(...args: any[]) {
  console.log('[rent webhook]', ...args);
}

export async function POST(req: Request) {
  if (!ENDPOINT_SECRET) {
    console.error('Missing webhook secret');
    return NextResponse.json(
      { error: 'Webhook secret not configured.' },
      { status: 500 }
    );
  }

  const headerStore = headers();
  const sig = headerStore.get('stripe-signature');
  if (!sig) {
    return NextResponse.json(
      { error: 'Missing Stripe signature.' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, ENDPOINT_SECRET);
  } catch (err: any) {
    console.error('Signature verification failed:', err);
    return NextResponse.json({ error: 'Bad signature.' }, { status: 400 });
  }

  try {
    switch (event.type) {
      // -----------------------------------------------------------
      // CHECKOUT SESSION COMPLETED (one-time payments)
      // -----------------------------------------------------------
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'payment') {
          log('Ignoring checkout.session.completed (not payment mode)');
          break;
        }

        const metadata = (session.metadata || {}) as Record<string, string>;

        // Derive payment type from metadata
        const metaType = metadata['type'] || null;

        // ===========================================================
        // 1) E-SIGN CREDITS PURCHASE
        // ===========================================================
        if (metaType === 'esign_purchase') {
          const landlordUserId = metadata['landlord_user_id'];
          const signaturesStr = metadata['signatures'];

          if (!landlordUserId) {
            log('E-sign purchase missing landlord_user_id.');
            break;
          }

          const signatures = Number(signaturesStr || '0');
          if (!signatures || signatures <= 0) {
            log('Invalid signatures value in e-sign purchase:', signaturesStr);
            break;
          }

          const amountTotal = session.amount_total;
          if (amountTotal == null) {
            log('No amount_total on e-sign purchase session.');
            break;
          }

          const amount_dollars = Math.round(amountTotal / 100);
          const paid_at = new Date().toISOString();
          const description =
            metadata['description'] ||
            (session as any).description ||
            'E-signature credits purchased';

          log('Inserting e-sign purchase:', {
            landlordUserId,
            signatures,
            amount_dollars,
          });

          const { error: esignInsertError } = await supabaseAdmin
            .from('esign_purchases')
            .insert([
              {
                landlord_user_id: landlordUserId,
                signatures,
                amount: amount_dollars,
                paid_at,
                stripe_payment_intent_id: session.payment_intent as string,
                stripe_checkout_session_id: session.id,
                description,
              },
            ]);

          if (esignInsertError) {
            console.error(
              '[webhook] Failed to insert into esign_purchases:',
              esignInsertError
            );
          }

          break; // STOP — DO NOT FALL THROUGH TO RENT LOGIC
        }

        // ===========================================================
        // 2) RENT PAYMENT (DEFAULT MODE)
        // ===========================================================
        const tenantIdStr = metadata['tenant_id'];
        if (!tenantIdStr) {
          log('Rent checkout.session.completed missing tenant_id → ignoring');
          break;
        }

        const tenant_id = Number(tenantIdStr);
        const property_id =
          metadata['property_id'] != null && metadata['property_id'] !== ''
            ? Number(metadata['property_id'])
            : null;

        const description = metadata['description'] || 'Rent payment';

        const amountTotal = session.amount_total;
        if (amountTotal == null) {
          log('Rent checkout missing amount_total');
          break;
        }

        const amount = Math.round(amountTotal / 100);
        const paid_on = new Date().toISOString().slice(0, 10);

        log('Inserting RENT payment:', {
          tenant_id,
          property_id,
          amount,
          paid_on,
        });

        const { error: rentInsertError } = await supabaseAdmin
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

        if (rentInsertError) {
          console.error('[webhook] rent insert error:', rentInsertError);
        }

        break;
      }

      // -----------------------------------------------------------
      // AUTOPAY VIA STRIPE INVOICES
      // -----------------------------------------------------------
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const metadata = (invoice.metadata || {}) as Record<string, string>;

        const tenantIdStr = metadata['tenant_id'];
        if (!tenantIdStr) {
          log('Autopay invoice missing tenant_id → ignoring');
          break;
        }

        const tenant_id = Number(tenantIdStr);
        const property_id =
          metadata['property_id'] != null && metadata['property_id'] !== ''
            ? Number(metadata['property_id'])
            : null;

        const amountPaid = invoice.amount_paid;
        if (amountPaid == null) {
          log('Autopay invoice missing amount_paid');
          break;
        }

        const amount = Math.round(amountPaid / 100);
        const paid_on = new Date().toISOString().slice(0, 10);
        const description =
          metadata['description'] ||
          invoice.description ||
          'Rent payment (autopay)';

        log('Inserting AUTOPAY payment:', {
          tenant_id,
          property_id,
          amount,
        });

        const { error: autopayInsertError } = await supabaseAdmin
          .from('payments')
          .insert([
            {
              tenant_id,
              property_id,
              amount,
              paid_on,
              method: 'card_autopay',
              note: description,
            },
          ]);

        if (autopayInsertError) {
          console.error(
            '[webhook] autopay insert error:',
            autopayInsertError
          );
        }

        break;
      }

      default:
        log('Unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error('[webhook] Unexpected error:', err);
    return NextResponse.json(
      { error: err?.message || 'Unexpected webhook error.' },
      { status: 500 }
    );
  }
}
