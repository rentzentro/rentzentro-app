// app/api/subscription/checkout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { createSubscriptionCheckout } from './checkoutFlow';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const SUBSCRIPTION_PRICE_ID = process.env.STRIPE_SUBSCRIPTION_PRICE_ID as string;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000';

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20' as any,
    })
  : null;

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    : null;
const supabaseAuth =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { landlordId } = body as { landlordId?: number };

  const result = await createSubscriptionCheckout({
    stripe,
    supabaseAdmin,
    supabaseAuth,
    subscriptionPriceId: SUBSCRIPTION_PRICE_ID,
    appUrl: APP_URL,
    authHeader: req.headers.get('authorization') || '',
    landlordId,
  });

  return NextResponse.json(result.body, { status: result.status });
}
