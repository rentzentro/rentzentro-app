// app/api/esign/purchase-webhook/route.ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { supabaseAdmin } from '../../../supabaseAdminClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Prefer a dedicated secret, fall back to general one if needed
const WEBHOOK_SECRET =
  process.env.STRIPE_ESIGN_WEBHOOK_SECRET ||
  process.env.STRIPE_WEBHOOK_SECRET ||
  '';

export async function POST(req: Request) {
  if (!WEBHOOK_SECRET) {
    console.error(
      '[esign/purchase-webhook] Missing STRIPE_ESIGN_WEBHOOK_SECRET / STRIPE_WEBHOOK_SECRET env var.'
    );
    return NextResponse.json(
      { error: 'Webhook secret not configured.' },
      { status: 500 }
    );
  }

  const sig = headers().get('stripe-signature');
  if (!sig) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header.' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('[esign/purchase-webhook] Signature error:', err);
    return NextResponse.json(
      { error: 'Invalid Stripe webhook signature.' },
      { status: 400 }
    );
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      // Only handle our e-sign purchases
      if (session.metadata?.type !== 'esign_purchase') {
        return NextResponse.json({ received: true }, { status: 200 });
      }

      const landlordUserId = session.metadata.landlord_user_id;
      const signaturesMeta = session.metadata.signatures;
      const signatures = signaturesMeta ? Number(signaturesMeta) : 0;

      if (!landlordUserId || !signatures || signatures <= 0) {
        console.error(
          '[esign/purchase-webhook] Missing landlordUserId or signatures in metadata.'
        );
        return NextResponse.json({ received: true }, { status: 200 });
      }

      // Only count paid sessions
      const isPaid =
        session.payment_status === 'paid' ||
        (session.status === 'complete' && session.amount_total);

      if (!isPaid) {
        console.log(
          '[esign/purchase-webhook] Checkout session not paid, skipping insert.'
        );
        return NextResponse.json({ received: true }, { status: 200 });
      }

      const amountCents = session.amount_total ?? null;
      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : (session.payment_intent as any)?.id ?? null;

      // Insert one row into esign_purchases
      const { error: insertError } = await supabaseAdmin
        .from('esign_purchases')
        .insert({
          landlord_user_id: landlordUserId,
          signatures,
          amount: amountCents,
          stripe_payment_intent_id: paymentIntentId,
          stripe_checkout_session_id: session.id,
          description:
            session.metadata?.description ||
            `E-signature package purchase x${signatures}`,
        });

      if (insertError) {
        console.error(
          '[esign/purchase-webhook] Error inserting purchase row:',
          insertError
        );
        return NextResponse.json(
          { error: 'Error logging e-sign purchase.' },
          { status: 500 }
        );
      }

      console.log(
        `[esign/purchase-webhook] Logged e-sign purchase: landlord=${landlordUserId}, signatures=${signatures}`
      );
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error('[esign/purchase-webhook] Handler error:', err);
    return NextResponse.json(
      { error: 'Server error handling e-sign webhook.' },
      { status: 500 }
    );
  }
}
