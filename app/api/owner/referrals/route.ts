import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../supabaseAdminClient';
import { enforceOwnerApiAccess } from '../../../lib/ownerApiAuth';
import { takeRateLimitToken } from '../../../lib/requestRateLimiter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReferralEventRow = {
  id: string;
  status: string | null;
  referrer_landlord_id: number;
  created_at: string;
};

type ReferralRewardRow = {
  id: string;
  status: string | null;
  reward_amount_cents: number | null;
  referrer_landlord_id: number;
};

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rate = takeRateLimitToken({
    key: `owner-referrals-summary:${ip}` ,
    limit: 120,
    windowMs: 60 * 1000,
  });

  if (!rate.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded for owner referral summary.' }, { status: 429 });
  }

  const auth = await enforceOwnerApiAccess({ req, supabaseAdmin });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  try {
    const [eventsRes, rewardsRes] = await Promise.all([
      supabaseAdmin
        .from('referral_events')
        .select('id, status, referrer_landlord_id, created_at')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('referral_rewards')
        .select('id, status, reward_amount_cents, referrer_landlord_id'),
    ]);

    if (eventsRes.error) throw eventsRes.error;
    if (rewardsRes.error) throw rewardsRes.error;

    const events = (eventsRes.data || []) as ReferralEventRow[];
    const rewards = (rewardsRes.data || []) as ReferralRewardRow[];

    const statusCounts = {
      attributed: 0,
      eligible: 0,
      awarded: 0,
      other: 0,
    };

    for (const event of events) {
      const status = String(event.status || '').toLowerCase();
      if (status === 'attributed') statusCounts.attributed += 1;
      else if (status === 'eligible') statusCounts.eligible += 1;
      else if (status === 'awarded') statusCounts.awarded += 1;
      else statusCounts.other += 1;
    }

    const rewardStatusCounts = {
      pending: 0,
      approved: 0,
      paid: 0,
      void: 0,
      other: 0,
    };

    let pendingAmountCents = 0;

    for (const reward of rewards) {
      const status = String(reward.status || '').toLowerCase();
      if (status === 'pending') {
        rewardStatusCounts.pending += 1;
        pendingAmountCents += Number(reward.reward_amount_cents || 0);
      } else if (status === 'approved') rewardStatusCounts.approved += 1;
      else if (status === 'paid') rewardStatusCounts.paid += 1;
      else if (status === 'void') rewardStatusCounts.void += 1;
      else rewardStatusCounts.other += 1;
    }

    return NextResponse.json({
      summary: {
        totalReferralEvents: events.length,
        eventStatus: statusCounts,
        totalRewards: rewards.length,
        rewardStatus: rewardStatusCounts,
        pendingRewardAmountCents: pendingAmountCents,
      },
      recentEvents: events.slice(0, 50),
    });
  } catch (err: any) {
    console.error('[owner/referrals] failed to load referral metrics:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to load referral metrics.' },
      { status: 500 }
    );
  }
}
