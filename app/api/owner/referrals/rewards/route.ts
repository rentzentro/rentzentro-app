import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../supabaseAdminClient';
import { applyReferralRewardAction, listReferralRewards } from './rewardAdminFlow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limitParam = Number(searchParams.get('limit') || 100);

  const result = await listReferralRewards({
    supabaseAdmin,
    limit: Number.isInteger(limitParam) ? limitParam : 100,
  });

  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(req: Request) {
  const payload = await req.json().catch(() => ({}));

  const result = await applyReferralRewardAction({
    supabaseAdmin,
    payload,
  });

  return NextResponse.json(result.body, { status: result.status });
}
