// app/api/subscription/checkout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// --- Stripe client ---
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  // Cast apiVersion so TypeScript stops underlining it in red
  apiVersion: '2024-06-20' as any,
});

// --- Environment variables ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const SUBSCRIPTION_PRICE_ID = process.env
  .STRIPE_SUBSCRIPTION_PRICE_ID as string;

// Base URL for redirects
const APP_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

// Supabase admin client (service role – bypasses RLS)
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

export async function POST(req: Request) {
  try {
    if (!SUBSCRIPTION_PRICE_ID) {
      console.error('Missing STRIPE_SUBSCRIPTION_PRICE_ID env var');
      return NextResponse.json(
        { error: 'Subscription price not configured on server.' },
        { status: 500 }
      );
    }

    // Expect landlordId in the JSON body
    const body = (await req.json().catch(() => null)) as
      | { landlordId?: number }
      | null;

    const landlordId = body?.landlordId;
    if (!landlordId || typeof landlordId !== 'number') {
      return NextResponse.json(
        { error: 'Missing or invalid landlordId in request body.' },
        { status: 400 }
      );
    }

    // Load landlord row so we have email + optional existing stripe_customer_id
    const { data: landlord, error: landlordError } = await supabaseAdmin
      .from('landlords')
      .select('id, email, stripe_customer_id')
      .eq('id', landlordId)
      .maybeSingle();

    if (landlordError) {
      console.error(
        'Error fetching landlord in subscription checkout:',
        landlordError
      );
      return NextResponse.json(
        { error: 'Unable to load landlord for subscription.' },
        { status: 500 }
      );
    }

    if (!landlord) {
      return NextResponse.json(
        { error: 'Landlord not found for subscription.' },
        { status: 404 }
      );
    }

    let customerId = landlord.stripe_customer_id as string | null;

    // Create Stripe customer if we don't have one yet
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: landlord.email || undefined,
        metadata: {
          landlordId: landlord.id.toString(),
        },
      });

      customerId = customer.id;

      // Save stripe_customer_id back on landlord row
      const { error: updateError } = await supabaseAdmin
        .from('landlords')
        .update({ stripe_customer_id: customerId })
        .eq('id', landlord.id);

      if (updateError) {
        console.error(
          'Error updating landlord with new stripe_customer_id:',
          updateError
        );
      }
    }

    // Create Checkout Session for subscription
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: SUBSCRIPTION_PRICE_ID,
          quantity: 1,
        },
      ],
      metadata: {
        landlordId: landlord.id.toString(),
      },
      // ✅ After success, send them to the landlord dashboard
      success_url: `${APP_URL}/landlord?subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
      // If they cancel Checkout, send them back to the settings/subscription screen
      cancel_url: `${APP_URL}/landlord/settings?billing=cancelled`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: 'Stripe did not return a checkout URL.' },
        { status: 500 }
      );
    }

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
