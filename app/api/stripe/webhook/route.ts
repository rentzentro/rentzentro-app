import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '../../../supabaseClient';

export const runtime = 'nodejs';

// --- Stripe setup ---
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  console.error('❌ STRIPE_SECRET_KEY is missing in environment variables');
}
if (!webhookSecret) {
  console.error('❌ STRIPE_WEBHOOK_SECRET is missing in environment variables');
}

// Force a real, stable API version but bypass the weird type that insists on the Clover preview
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20' as any,
    })
  : null;

// Simple GET for sanity check in a browser
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Stripe webhook endpoint is reachable',
  });
}

export async function POST(req: NextRequest) {
  if (!stripe || !webhookSecret) {
    console.error('❌ Webhook called but Stripe or webhook secret is not configured.');
    return new NextResponse('Stripe not configured on server', { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    console.error('❌ Missing stripe-signature header');
    return new NextResponse('Missing stripe-signature header', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('❌ Stripe signature verification failed:', err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log('🔔 Stripe webhook event type:', event.type);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log('📦 Session metadata:', session.metadata);
      console.log('📦 amount_total:', session.amount_total);

      const tenantId = Number(session.metadata?.tenant_id);
      const propertyId = Number(session.metadata?.property_id);
      const amount = session.amount_total != null ? session.amount_total / 100 : null;

      if (!tenantId || !propertyId || !amount) {
        console.error('⚠️ Missing tenant_id, property_id, or amount_total in session metadata.', {
          tenantId,
          propertyId,
          amount,
        });
        return new NextResponse('Missing metadata', { status: 400 });
      }

      console.log('💾 Inserting payment into Supabase:', {
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
        console.error('❌ Supabase insert error in webhook:', error);
        // IMPORTANT: return 500 so Stripe shows a failure if DB write fails
        return new NextResponse('Database error while inserting payment', { status: 500 });
      }

      console.log('✅ Payment inserted successfully into Supabase');
    } else {
      console.log('ℹ️ Webhook event type not handled:', event.type);
    }

    // If we reach here, we successfully handled the event
    return new NextResponse('OK', { status: 200 });
  } catch (err: any) {
    console.error('❌ Unexpected error in Stripe webhook handler:', err);
    return new NextResponse('Webhook handler error', { status: 500 });
  }
}
