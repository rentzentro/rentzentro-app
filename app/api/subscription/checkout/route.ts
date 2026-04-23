// app/api/subscription/checkout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from '../../../lib/supabaseEnv';
import { createSubscriptionCheckout } from './checkoutFlow';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const SUPABASE_URL = getSupabaseUrl() as string;
const SERVICE_ROLE_KEY = getSupabaseServiceRoleKey() as string;
const SUBSCRIPTION_PRICE_ID = process.env.STRIPE_SUBSCRIPTION_PRICE_ID as string;
const SUBSCRIPTION_PRICE_ID_STARTER =
  process.env.STRIPE_SUBSCRIPTION_PRICE_ID_STARTER as string;
const SUBSCRIPTION_PRICE_ID_CORE = process.env.STRIPE_SUBSCRIPTION_PRICE_ID_CORE as string;
const SUBSCRIPTION_PRICE_ID_GROWTH =
  process.env.STRIPE_SUBSCRIPTION_PRICE_ID_GROWTH as string;
const SUPABASE_ANON_KEY = getSupabaseAnonKey() as string;
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
  const { landlordId, planKey } = body as {
    landlordId?: number;
    planKey?: 'starter' | 'core' | 'growth';
  };

  const normalizedPlanKey =
    planKey === 'starter' || planKey === 'core' || planKey === 'growth' ? planKey : 'core';
  const priceMap = {
    starter: SUBSCRIPTION_PRICE_ID_STARTER || '',
    core: SUBSCRIPTION_PRICE_ID_CORE || SUBSCRIPTION_PRICE_ID || '',
    growth: SUBSCRIPTION_PRICE_ID_GROWTH || '',
  } as const;
  const unitLimitByPlan = {
    starter: 3,
    core: 20,
    growth: 75,
  } as const;

  const selectedPriceId = priceMap[normalizedPlanKey];

  if (!selectedPriceId) {
    return NextResponse.json(
      { error: `Stripe price ID is missing for the "${normalizedPlanKey}" plan.` },
      { status: 500 }
    );
  }

  const result = await createSubscriptionCheckout({
    stripe,
    supabaseAdmin,
    supabaseAuth,
    subscriptionPriceId: selectedPriceId,
    selectedPlanKey: normalizedPlanKey,
    selectedPlanUnitLimit: unitLimitByPlan[normalizedPlanKey],
    appUrl: APP_URL,
    authHeader: req.headers.get('authorization') || '',
    landlordId,
  });

  return NextResponse.json(result.body, { status: result.status });
}
