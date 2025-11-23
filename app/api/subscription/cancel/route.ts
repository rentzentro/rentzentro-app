// app/api/subscription/cancel/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase service role env vars');
}

const stripe = new Stripe(stripeSecretKey as string);
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { landlordId } = body as { landlordId?: number };

    if (!landlordId) {
      return NextResponse.json(
        { error: 'Missing landlordId in request body.' },
        { status: 400 }
      );
    }

    // Load landlord to get subscription id
    const { data: landlord, error: landlordError } = await supabaseAdmin
      .from('landlords')
      .select('id, stripe_subscription_id')
      .eq('id', landlordId)
      .maybeSingle();

    if (landlordError) {
      console.error('Error loading landlord for cancel:', landlordError);
      return NextResponse.json(
        { error: 'Unable to load landlord for subscription cancel.' },
        { status: 500 }
      );
    }

    if (!landlord || !landlord.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription found for this landlord.' },
        { status: 400 }
      );
    }

    const subscriptionId = landlord.stripe_subscription_id as string;

    // Cancel at period end so they keep access until the end of the billing cycle
    const updated = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    // We do NOT immediately change subscription_status here.
    // The Stripe "customer.subscription.updated" / "deleted" webhook
    // will update the landlords table when the subscription actually ends.

    return NextResponse.json(
      {
        ok: true,
        subscriptionId: updated.id,
        status: updated.status,
        cancel_at_period_end: updated.cancel_at_period_end,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('Subscription cancel error:', err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          'Something went wrong while cancelling the subscription.',
      },
      { status: 500 }
    );
  }
}
