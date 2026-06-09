// app/api/checkout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '../../supabaseAdminClient';
import { createCheckoutSession } from './checkoutFlow';
import { getRateLimitClientIp, takeRateLimitToken } from '../../lib/requestRateLimiter';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://www.rentzentro.com';

const ESIGN_PRICE_ID = process.env.STRIPE_ESIGN_PRICE_ID as string | undefined;

async function getAuthenticatedTenantFromRequest(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data?.user) {
    console.warn('checkout: unable to verify tenant auth token', error);
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email || null,
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const clientIp = getRateLimitClientIp(req);
  const tenantId = body?.tenantId || body?.tenant_id || 'unknown';

  const ipRateLimit = takeRateLimitToken({
    key: `checkout:ip:${clientIp}`,
    limit: 8,
    windowMs: 10 * 60 * 1000,
  });

  if (!ipRateLimit.ok) {
    return NextResponse.json(
      { error: 'Too many payment attempts from this network. Please try again shortly.' },
      { status: 429 }
    );
  }

  const tenantRateLimit = takeRateLimitToken({
    key: `checkout:tenant:${tenantId}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });

  if (!tenantRateLimit.ok) {
    return NextResponse.json(
      { error: 'Too many payment attempts on this tenant account. Please wait and retry.' },
      { status: 429 }
    );
  }

  const authenticatedTenant = await getAuthenticatedTenantFromRequest(req);

  const result = await createCheckoutSession({
    stripe,
    supabaseAdmin,
    appUrl: APP_URL,
    esignPriceId: ESIGN_PRICE_ID,
    body: {
      ...body,
      authUserId: authenticatedTenant?.id || body?.authUserId || null,
      authEmail: authenticatedTenant?.email || body?.authEmail || null,
    },
  });

  return NextResponse.json(result.body, { status: result.status });
}
