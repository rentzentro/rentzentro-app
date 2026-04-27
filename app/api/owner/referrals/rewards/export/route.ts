import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../supabaseAdminClient';
import { enforceOwnerApiAccess } from '../../../../../lib/ownerApiAuth';
import {
  getRateLimitClientIp,
  takeRateLimitToken,
} from '../../../../../lib/requestRateLimiter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const csvEscape = (value: unknown) => {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export async function GET(req: Request) {
  const ip = getRateLimitClientIp(req);
  const rate = takeRateLimitToken({
    key: `owner-referrals-export:${ip}`,
    limit: 20,
    windowMs: 60 * 1000,
  });

  if (!rate.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded for reward exports.' }, { status: 429 });
  }

  const auth = await enforceOwnerApiAccess({ req, supabaseAdmin });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get('status') || 'approved').toLowerCase();

  const { data, error } = await supabaseAdmin
    .from('referral_rewards')
    .select(
      'id, referral_event_id, referrer_landlord_id, referred_landlord_id, reward_amount_cents, status, eligible_at, approved_at, paid_at, processed_by, external_payout_id, notes'
    )
    .eq('status', status)
    .order('eligible_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: 'Failed to export referral rewards.' },
      { status: 500 }
    );
  }

  const rows = data || [];
  const header = [
    'reward_id',
    'referral_event_id',
    'referrer_landlord_id',
    'referred_landlord_id',
    'reward_amount_cents',
    'status',
    'eligible_at',
    'approved_at',
    'paid_at',
    'processed_by',
    'external_payout_id',
    'notes',
  ];

  const csv = [
    header.join(','),
    ...rows.map((row: any) =>
      [
        row.id,
        row.referral_event_id,
        row.referrer_landlord_id,
        row.referred_landlord_id,
        row.reward_amount_cents,
        row.status,
        row.eligible_at,
        row.approved_at,
        row.paid_at,
        row.processed_by,
        row.external_payout_id,
        row.notes,
      ]
        .map(csvEscape)
        .join(',')
    ),
  ].join('\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="referral-rewards-${status}.csv"`,
    },
  });
}
