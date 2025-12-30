// app/api/tenant-landlord-access/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const parseSupabaseDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const ownerId = String(body?.ownerId || '').trim();

    if (!ownerId) {
      return NextResponse.json(
        { allowed: false, reason: 'Missing landlord owner id.' },
        { status: 400 }
      );
    }

    // IMPORTANT: your landlords table uses user_id (uuid) to match the landlord auth UID.
    // This admin query bypasses RLS.
    const { data: landlord, error } = await supabaseAdmin
      .from('landlords')
      .select('id, user_id, email, subscription_status, trial_active, trial_end')
      .eq('user_id', ownerId)
      .maybeSingle();

    if (error) {
      console.error('tenant-landlord-access lookup error:', error);
      // Fail OPEN (do NOT block paying customers if we have a temporary lookup issue)
      return NextResponse.json({
        allowed: true,
        reason: 'Temporary verification issue (fail-open).',
      });
    }

    if (!landlord) {
      // No landlord record found for that ownerId — this is a real configuration problem.
      return NextResponse.json({
        allowed: false,
        reason:
          "Online payments and maintenance are temporarily unavailable because your landlord's account could not be found. Please contact your landlord or property manager.",
      });
    }

    const status = String(landlord.subscription_status || '').toLowerCase();

    const isPaidPlanActive =
      status === 'active' ||
      status === 'trialing' ||
      status === 'active_cancel_at_period_end';

    const now = new Date();
    const trialEnd = parseSupabaseDate(landlord.trial_end);
    const promoActive =
      !!landlord.trial_active &&
      !!trialEnd &&
      !Number.isNaN(trialEnd.getTime()) &&
      trialEnd >= now;

    const allowed = isPaidPlanActive || promoActive;

    if (!allowed) {
      return NextResponse.json({
        allowed: false,
        reason:
          "Online payments and maintenance are temporarily unavailable because your landlord's RentZentro account is not currently active. Please contact your landlord or property manager.",
      });
    }

    return NextResponse.json({ allowed: true });
  } catch (e: any) {
    console.error('tenant-landlord-access route error:', e);
    // Fail OPEN to avoid blocking rent collection due to unexpected server issues
    return NextResponse.json({
      allowed: true,
      reason: 'Temporary verification issue (fail-open).',
    });
  }
}
