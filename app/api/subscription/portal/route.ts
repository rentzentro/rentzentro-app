// app/api/subscription/portal/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from '../../../lib/supabaseEnv';
import { createSubscriptionPortal } from './portalFlow';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const SUPABASE_URL = getSupabaseUrl() as string;
const SERVICE_ROLE_KEY = getSupabaseServiceRoleKey() as string;
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
  const { landlordId } = body as { landlordId?: number };

  const result = await createSubscriptionPortal({
    stripe,
    supabaseAdmin,
    supabaseAuth,
    appUrl: APP_URL,
    authHeader: req.headers.get('authorization') || '',
    landlordId,
  });

  if (result.status >= 500) {
    console.error('Billing portal error:', result.body.error);
  }

  return NextResponse.json(result.body, { status: result.status });
}
