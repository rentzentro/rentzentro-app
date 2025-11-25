// app/api/stripe/webhook/route.ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Stripe init
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20' as any,
});

// Supabase admin client (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const ENDPOINT_SECRET = process.env.STRIPE_WEBHOOK_SECRET as string;

export async function POST(req: Request) {
  if (!ENDPOINT_SECRET) {
    console.error('Missing STRIPE_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const rawBody = await req.text();
  const sig = headers().get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, ENDPOINT_SECRET);
  } catch (err: any) {
    console.error('Stripe webhook signature fail:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.mode !== 'payment') {
        console.log('[rent webhook] non-payment session, ignoring');
        return NextResponse.json({ received: true });
      }

      const metadata = session.metadata ?? {};

      // ✅ USE THE CORRECT KEYS (snake_case)
      const tenantId = Number(metadata.tenant_id);
      const propertyId = metadata.property_id ? Number(metadata.property_id) : null;
      const landlordId = metadata.landlord_id ? Number(metadata.landlord_id) : null;

      if (!tenantId || Number.isNaN(tenantId)) {
        console.error('[rent webhook] Missing or invalid tenant_id in metadata:', metadata);
        return NextResponse.json({ error: 'Missing tenant_id' }, { status: 400 });
      }

      const amountCents = session.amount_total;
      if (!amountCents) {
        console.error('[rent webhook] No amount_total');
        return NextResponse.json({ error: 'Missing amount' }, { status: 400 });
      }

      const amount = Math.round(amountCents / 100);
      const paidOn = new Date().toISOString().slice(0, 10);

      console.log('[rent webhook] inserting payment:', {
        tenantId,
        propertyId,
        landlordId,
        amount,
        paidOn,
      });

      const { error: insertError } = await supabaseAdmin
        .from('payments')
        .insert({
          tenant_id: tenantId,
          property_id: propertyId,
          owner_id: landlordId, // landlord link
          amount,
          paid_on: paidOn,
          method: 'card',
          note: 'Rent payment',
        });

      if (insertError) {
        console.error('[rent webhook] Insert error:', insertError);
        return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error('[rent webhook] error:', err);
    return NextResponse.json({ error: err?.message || 'Webhook error' }, { status: 500 });
  }
}
