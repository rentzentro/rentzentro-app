// app/api/owner/metrics/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

export async function GET() {
  try {
    // ---------- Landlords ----------
    const {
      data: landlordsData,
      count: totalLandlords,
      error: landlordsError,
    } = await supabaseAdmin
      .from('landlords')
      .select('id, subscription_status', { count: 'exact' });

    if (landlordsError) throw landlordsError;

    const paidLandlords =
      landlordsData?.filter((l) => {
        const s = (l.subscription_status || '').toLowerCase();
        return s === 'active' || s === 'active_cancel_at_period_end';
      }).length ?? 0;

    const trialLandlords =
      landlordsData?.filter((l) => {
        const s = (l.subscription_status || '').toLowerCase();
        return s === 'trialing';
      }).length ?? 0;

    // ---------- Properties ----------
    const {
      data: propertiesData,
      count: totalProperties,
      error: propertiesError,
    } = await supabaseAdmin
      .from('properties')
      .select('monthly_rent, status', { count: 'exact' });

    if (propertiesError) throw propertiesError;

    const totalMonthlyRent =
      propertiesData
        ?.filter((p) => (p.status || '').toLowerCase() === 'current')
        .reduce((sum, p) => sum + (p.monthly_rent || 0), 0) ?? 0;

    // ---------- Tenants ----------
    const {
      count: totalTenants,
      error: tenantsError,
    } = await supabaseAdmin
      .from('tenants')
      .select('id', { count: 'exact', head: true });

    if (tenantsError) throw tenantsError;

    // ---------- Payments (last 30 days) ----------
    const now = new Date();
    const thirtyDaysAgo = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 30
    );

    const {
      data: paymentsData,
      error: paymentsError,
    } = await supabaseAdmin
      .from('payments')
      .select('amount, paid_on')
      .gte('paid_on', thirtyDaysAgo.toISOString());

    if (paymentsError) throw paymentsError;

    const paymentsLast30Days =
      paymentsData?.reduce((sum, p) => sum + (p.amount || 0), 0) ?? 0;

    // ---------- MRR (rough) ----------
    const MRR = paidLandlords * 29.95;

    return NextResponse.json(
      {
        totalLandlords: totalLandlords ?? 0,
        totalProperties: totalProperties ?? 0,
        totalTenants: totalTenants ?? 0,
        totalMonthlyRent,
        paidLandlords,
        trialLandlords,
        MRR,
        paymentsLast30Days,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[owner metrics] Error:', err);
    return NextResponse.json(
      {
        error:
          err?.message || 'Failed to load owner metrics. Check server logs.',
      },
      { status: 500 }
    );
  }
}
