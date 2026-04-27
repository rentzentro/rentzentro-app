import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../supabaseAdminClient';
import { enforceOwnerApiAccess } from '../../../../lib/ownerApiAuth';
import { takeRateLimitToken } from '../../../../lib/requestRateLimiter';
import { applyReferralRewardAction, listReferralRewards } from './rewardAdminFlow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rate = takeRateLimitToken({
    key: `owner-referrals-rewards:get:${ip}` ,
    limit: 120,
    windowMs: 60 * 1000,
  });

  if (!rate.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded for rewards list.' }, { status: 429 });
  }

  const auth = await enforceOwnerApiAccess({ req, supabaseAdmin });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const limitParam = Number(searchParams.get('limit') || 100);

  const result = await listReferralRewards({
    supabaseAdmin,
    limit: Number.isInteger(limitParam) ? limitParam : 100,
  });

  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rate = takeRateLimitToken({
    key: `owner-referrals-rewards:post:${ip}` ,
    limit: 60,
    windowMs: 60 * 1000,
  });

  if (!rate.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded for reward actions.' }, { status: 429 });
  }

  const auth = await enforceOwnerApiAccess({ req, supabaseAdmin });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const payload = await req.json().catch(() => ({}));

  const result = await applyReferralRewardAction({
    supabaseAdmin,
    payload,
  });

  return NextResponse.json(result.body, { status: result.status });
}
