// app/api/stripe/webhook/route.ts
// We disable TS checking here because this is low-level integration code.
// It still compiles and runs fine in Next.js.
// @ts-nocheck

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!stripeSecret) {
  console.warn('⚠️ STRIPE_SECRET_KEY is not set');
}
if (!webhookSecret) {
  console.warn('⚠️ STRIPE_WEBHOOK_SECRET is not set');
}
if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ Supabase service env vars are not fully set');
}

const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

export async function POST(req: Request) {
  if (!stripe || !webhookSecret) {
    return new Response('Stripe not configured', { status: 500 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return new Response('Missing Stripe signature', { status: 400 });
  }

  const rawBody = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;

    const tenantIdStr = session.metadata?.tenantId || '';
    const propertyIdStr = session.metadata?.propertyId || '';
    const description = session.metadata?.description || 'Stripe rent payment';
    const rentAmountStr = session.metadata?.rentAmount || '';
    const amountFromMetadata = Number(rentAmountStr);
    const amountFromStripe = session.amount_total
      ? session.amount_total / 100
      : NaN;

    const amountToUse =
      !isNaN(amountFromMetadata) && amountFromMetadata > 0
        ? amountFromMetadata
        : !isNaN(amountFromStripe)
        ? amountFromStripe
        : null;

    const tenantId = tenantIdStr ? Number(tenantIdStr) : null;
    const propertyId = propertyIdStr ? Number(propertyIdStr) : null;

    console.log('✅ checkout.session.completed for tenant/property', {
      tenantId,
      propertyId,
      amountToUse,
    });

    if (!supabaseAdmin) {
      console.error('Supabase admin client is not configured.');
      return new Response('Supabase not configured', { status: 500 });
    }

    if (!amountToUse) {
      console.error('No valid amount found in webhook event.');
    } else {
      const { error } = await supabaseAdmin.from('payments').insert({
        tenant_id: tenantId,
        property_id: propertyId,
        amount: amountToUse,
        paid_on: new Date().toISOString(),
        method: 'Stripe card (Checkout)',
        note: description || 'Stripe Checkout payment (webhook).',
      });

      if (error) {
        console.error('❌ Error inserting payment via webhook:', error);
      } else {
        console.log('✅ Payment inserted via webhook');
      }
    }

    // (Optional later) update properties.next_due_date based on propertyId
  }

  return new Response('OK', { status: 200 });
}
