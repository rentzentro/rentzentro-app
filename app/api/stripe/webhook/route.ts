import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '../../../supabaseClient';

export const runtime = 'nodejs'; // ensure Node.js runtime for Stripe

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecret) {
  console.error('❌ Missing STRIPE_SECRET_KEY environment variable.');
}

if (!webhookSecret) {
  console.error('❌ Missing STRIPE_WEBHOOK_SECRET environment variable.');
}

const stripe = stripeSecret
  ? new Stripe(stripeSecret, {
      apiVersion: '2023-10-16',
    })
  : (null as unknown as Stripe);

export async function POST(req: NextRequest) {
  if (!stripe || !webhookSecret) {
    console.error('❌ Stripe not configured correctly on the server.');
    return new NextResponse('Stripe not configured', { status: 500 });
  }

  // Stripe needs the RAW body text for signature verification
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  let event: Stripe.Event;

  try {
    if (!sig) {
      throw new Error('Missing stripe-signature header');
    }

    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log('🔔 Stripe webhook received:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // We expect metadata to identify tenant + property
        const metadata = session.metadata || {};
        console.log('📎 Session metadata:', metadata);

        const tenantIdRaw =
          metadata.tenant_id || metadata.tenantId || metadata.tenant;
        const propertyIdRaw =
          metadata.property_id || metadata.propertyId || metadata.property;

        const amountTotal = session.amount_total; // in cents

        if (!tenantIdRaw || !propertyIdRaw || !amountTotal) {
          console.warn(
            '⚠️ Missing tenant/property/amount in session metadata. Skipping payment insert.'
          );
          break;
        }

        const tenantId = Number(tenantIdRaw);
        const propertyId = Number(propertyIdRaw);
        const amount = amountTotal / 100; // convert cents → dollars
        const paidOn = new Date().toISOString();

        console.log('💾 Inserting payment into Supabase:', {
          tenant_id: tenantId,
          property_id: propertyId,
          amount,
          paid_on: paidOn,
        });

        const { error } = await supabase.from('payments').insert({
          tenant_id: tenantId,
          property_id: propertyId,
          amount,
          paid_on: paidOn,
          method: 'card',
          note: 'Stripe Checkout payment',
        });

        if (error) {
          console.error('❌ Supabase insert error:', error);
          return new NextResponse('Supabase insert error', { status: 500 });
        }

        console.log('✅ Payment recorded in Supabase for tenant', tenantId);

        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return new NextResponse('OK', { status: 200 });
  } catch (err: any) {
    console.error('❌ Webhook handler error:', err);
    return new NextResponse('Webhook handler error', { status: 500 });
  }
}
