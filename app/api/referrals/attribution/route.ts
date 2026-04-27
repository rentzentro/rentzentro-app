import { NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseAdminConfigured } from '../../../supabaseAdminClient';
import { attributeReferral } from './attributionFlow';
import { getRateLimitClientIp, takeRateLimitToken } from '../../../lib/requestRateLimiter';

export async function POST(req: Request) {
  const ip = getRateLimitClientIp(req);
  const rate = takeRateLimitToken({
    key: `referral-attribution:${ip}`,
    limit: 45,
    windowMs: 60 * 1000,
  });

  if (!rate.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded for referral attribution.' }, { status: 429 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: 'Supabase admin client is not configured.' },
      { status: 500 }
    );
  }

  const payload = await req.json().catch(() => ({}));

  const result = await attributeReferral({
    supabaseAdmin,
    payload,
  });

  return NextResponse.json(result.body, { status: result.status });
}
