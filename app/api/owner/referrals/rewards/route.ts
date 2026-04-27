import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../supabaseAdminClient';
import { enforceOwnerApiAccess } from '../../../../lib/ownerApiAuth';
import { applyReferralRewardAction, listReferralRewards } from './rewardAdminFlow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = enforceOwnerApiAccess(req);
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
  const auth = enforceOwnerApiAccess(req);
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
