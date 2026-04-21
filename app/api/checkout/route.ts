// app/api/checkout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '../../supabaseAdminClient';
import { createCheckoutSession } from './checkoutFlow';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://www.rentzentro.com';

const ESIGN_PRICE_ID = process.env.STRIPE_ESIGN_PRICE_ID as string | undefined;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const result = await createCheckoutSession({
    stripe,
    supabaseAdmin,
    appUrl: APP_URL,
    esignPriceId: ESIGN_PRICE_ID,
    body,
  });

  return NextResponse.json(result.body, { status: result.status });
}
