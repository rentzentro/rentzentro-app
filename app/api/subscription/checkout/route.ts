// app/api/subscription/checkout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const SUBSCRIPTION_PRICE_ID = process.env.STRIPE_SUBSCRIPTION_PRICE_ID as string;
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000';

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20' as any,
});

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

export async function POST(req: Request) {
  try {
    if (!STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe secret key not configured on server.' },
        { status: 500 }
      );
    }

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Supabase admin credentials not configured on server.' },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { landlordId } = body as { landlordId?: number };

    if (!landlordId || typeof landlordId !== 'number') {
      return NextResponse.json(
        { error: 'Missing or invalid landlordId in request body.' },
        { status: 400 }
      );
    }

    if (!SUBSCRIPTION_PRICE_ID) {
      return NextResponse.json(
        { error: 'Subscription price not configured on server.' },
        { status: 500 }
      );
    }

    // 1) Load landlord row
    const { data: landlord, error: landlordError } = await supabaseAdmin
      .from('landlords')
      .select('id, email, stripe_customer_id')
      .eq('id', landlordId)
      .maybeSingle();

    if (landlordError) {
      console.error('Error loading landlord in checkout route:', landlordError);
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

    // 2) Ensure Stripe customer
    let customerId = (landlord.stripe_customer_id as string | null) || null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: landlord.email,
        metadata: {
          landlordId: String(landlord.id),
        },
      });

      customerId = customer.id;

      const { error: updateError } = await supabaseAdmin
        .from('landlords')
        .update({ stripe_customer_id: customerId })
        .eq('id', landlord.id);

      if (updateError) {
        console.error(
          'Error updating landlord with stripe_customer_id:',
          updateError
        );
      }
    }

    // 3) Create subscription Checkout Session
    // IMPORTANT:
    // - session.metadata does NOT reliably propagate to the Subscription/Invoice.
    // - Put landlordId onto subscription_data.metadata so webhooks like invoice.* can read it.
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: String(landlord.id),
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
      subscription_data: {
        metadata: {
          landlordId: String(landlord.id),
        },
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: 'Stripe session created without a redirect URL.' },
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
