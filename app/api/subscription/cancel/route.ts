// app/api/subscription/cancel/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const stripe = new Stripe(STRIPE_SECRET_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { landlordId } = body as { landlordId?: number };

    if (!landlordId || typeof landlordId !== 'number') {
      return NextResponse.json(
        { error: 'Missing or invalid landlordId.' },
        { status: 400 }
      );
    }

    // Look up landlord to get their Stripe subscription ID
    const { data: landlord, error: landlordError } = await supabaseAdmin
      .from('landlords')
      .select('stripe_subscription_id')
      .eq('id', landlordId)
      .maybeSingle();

    if (landlordError) {
      console.error('Error loading landlord in cancel route:', landlordError);
      return NextResponse.json(
        { error: 'Unable to load landlord account.' },
        { status: 500 }
      );
    }

    if (!landlord) {
      return NextResponse.json(
        { error: 'Landlord not found.' },
        { status: 404 }
      );
    }

    if (!landlord.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription to cancel.' },
        { status: 400 }
      );
    }

    // Cancel at period end (they keep access until Stripe ends it)
    await stripe.subscriptions.update(landlord.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    // We let the Stripe webhook update subscription_status when the period actually ends.
    // Here we just confirm success.
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error('Subscription cancel error:', err);
    return NextResponse.json(
      { error: err?.message || 'Unexpected error cancelling subscription.' },
      { status: 500 }
    );
  }
}
