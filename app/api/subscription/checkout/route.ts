// app/api/subscription/checkout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// ---- Stripe client ----
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is not set on the server.');
}

const stripe = new Stripe(stripeSecretKey, {
  // apiVersion is optional; leaving it out avoids TS complaining in some setups
  // apiVersion: '2024-06-20',
});

// ---- Supabase (service role) ----
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Supabase service-role environment variables are not set.');
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ---- Route handler ----
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

    // Read these INSIDE the handler so we’re sure we see the env from Vercel
    const SUBSCRIPTION_PRICE_ID = process.env.STRIPE_SUBSCRIPTION_PRICE_ID;
    const APP_URL =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'http://localhost:3000';

    // Debug log to Vercel function logs
    console.log('DEBUG PRICE:', SUBSCRIPTION_PRICE_ID);

    if (!SUBSCRIPTION_PRICE_ID) {
      return NextResponse.json(
        { error: 'Subscription price not configured on server.' },
        { status: 500 }
      );
    }

    // 1) Load landlord so we have email + (optional) existing customer id
    const { data: landlord, error: landlordError } = await supabaseAdmin
      .from('landlords')
      .select('id, email, stripe_customer_id')
      .eq('id', landlordId)
      .maybeSingle();

    if (landlordError) throw landlordError;
    if (!landlord) {
      return NextResponse.json(
        { error: 'Landlord not found.' },
        { status: 404 }
      );
    }

    let customerId = landlord.stripe_customer_id as string | null;

    // 2) Create Stripe customer if needed
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: landlord.email,
        metadata: {
          landlordId: String(landlord.id),
        },
      });

      customerId = customer.id;

      // Save customer id on landlord row
      await supabaseAdmin
        .from('landlords')
        .update({ stripe_customer_id: customerId })
        .eq('id', landlord.id);
    }

    // 3) Create subscription Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: SUBSCRIPTION_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${APP_URL}/landlord/settings?billing=success`,
      cancel_url: `${APP_URL}/landlord/settings?billing=cancelled`,
      metadata: {
        landlordId: String(landlord.id),
      },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error('Subscription checkout error:', err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          'Something went wrong creating the subscription checkout session.',
      },
      { status: 500 }
    );
  }
}
