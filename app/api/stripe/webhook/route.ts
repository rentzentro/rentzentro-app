import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '../../../supabaseClient';

export const runtime = 'nodejs';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecret) console.error('❌ Missing STRIPE_SECRET_KEY');
if (!webhookSecret) console.error('❌ Missing STRIPE_WEBHOOK_SECRET');

const stripe = new Stripe(stripeSecret!, {
  // StackBlitz is forcing this preview API version type
  apiVersion: '2025-10-29.clover',
});

// Simple GET so you can verify the URL in a browser
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Stripe webhook endpoint reachable',
  });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    console.error('❌ Missing stripe-signature header');
    return new NextResponse('No signature', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret!);
  } catch (err: any) {
    console.error('❌ Signature verification failed:', err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log('🔔 Webhook received:', event.type);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log('📦 Session metadata:', session.metadata);

      const tenantId = Number(session.metadata?.tenant_id);
      const propertyId = Number(session.metadata?.property_id);
      const amount = (session.amount_total || 0) / 100;

      if (!tenantId || !propertyId || !amount) {
        console.warn(
          '⚠️ Missing tenant_id, property_id, or amount_total. Skipping insert.'
        );
        return new NextResponse('Missing metadata', { status: 400 });
      }

      console.log('💾 Inserting payment:', {
        tenant_id: tenantId,
        property_id: propertyId,
        amount,
      });

      const { error } = await supabase.from('payments').insert({
        tenant_id: tenantId,
        property_id: propertyId,
        amount,
        paid_on: new Date().toISOString(),
        method: 'card',
        note: 'Stripe Checkout payment',
      });

      if (error) {
        console.error('❌ Supabase insert error:', error);
        return new NextResponse('Database error', { status: 500 });
      }

      console.log('✅ Payment inserted successfully');
    } else {
      console.log('ℹ️ Unhandled event type:', event.type);
    }

    return new NextResponse('OK', { status: 200 });
  } catch (err: any) {
    console.error('❌ Webhook handler error:', err);
    return new NextResponse('Webhook handler error', { status: 500 });
  }
}
