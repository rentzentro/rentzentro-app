import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecret) console.error('❌ Missing STRIPE_SECRET_KEY');
if (!webhookSecret) console.error('❌ Missing STRIPE_WEBHOOK_SECRET');

const stripe = new Stripe(stripeSecret!); // ← NO apiVersion override

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---- GET (test URL) ----
export async function GET() {
  return NextResponse.json({ ok: true, message: 'Webhook reachable' });
}

// ---- POST (Stripe events) ----
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    console.error('❌ Missing stripe-signature');
    return new NextResponse('No signature', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret!);
  } catch (err: any) {
    console.error('❌ Signature verification failed:', err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log('🔔 Event received:', event.type);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    const tenantId = Number(session.metadata?.tenant_id);
    const propertyId = Number(session.metadata?.property_id);
    const amount = (session.amount_total ?? 0) / 100;

    if (!tenantId || !propertyId || !amount) {
      console.warn('⚠️ Missing metadata fields, skipping');
      return new NextResponse('Missing metadata', { status: 400 });
    }

    console.log('💾 Inserting payment into Supabase...');

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
      return new NextResponse('DB insert failed', { status: 500 });
    }

    console.log('✅ Payment saved');
  }

  return new NextResponse('OK', { status: 200 });
}
