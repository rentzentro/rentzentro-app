import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// ---------- Stripe client ----------
// No apiVersion here – fixes the red underline.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// If env is being weird, fallback to the known price ID.
// (Price IDs are not secret, it’s OK to have this in code.)
const FALLBACK_SUBSCRIPTION_PRICE_ID = 'price_1SWJTQPbPgn5DmhBanWMq830';

// ---------- Supabase (admin) ----------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000';

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ---------- Handler ----------

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

    // Read env inside the handler
    const envPriceId = process.env.STRIPE_SUBSCRIPTION_PRICE_ID;
    const SUBSCRIPTION_PRICE_ID =
      envPriceId && envPriceId.length > 0
        ? envPriceId
        : FALLBACK_SUBSCRIPTION_PRICE_ID;

    console.log('DEBUG PRICE (env):', envPriceId);
    console.log('DEBUG PRICE (using):', SUBSCRIPTION_PRICE_ID);

    if (!SUBSCRIPTION_PRICE_ID) {
      return NextResponse.json(
        { error: 'Subscription price not configured on server.' },
        { status: 500 }
      );
    }

    // 1) Load landlord (email + optional existing customer id)
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
