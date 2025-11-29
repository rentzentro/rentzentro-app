// app/api/owner/metrics/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

type LandlordRow = {
  id: number;
  subscription_status: string | null;
  trial_active?: boolean | null;
  trial_end?: string | null;
};

type PropertyRow = {
  id: number;
  monthly_rent: number | null;
};

type TenantRow = {
  id: number;
};

type PaymentRow = {
  id: number;
  amount: number | null;
  paid_on: string | null;
};

export async function GET() {
  try {
    // --- Load all the raw rows we need ---

    const [
      landlordsRes,
      propertiesRes,
      tenantsRes,
      paymentsRes,
    ] = await Promise.all([
      supabaseAdmin
        .from('landlords')
        .select('id, subscription_status, trial_active, trial_end'),
      supabaseAdmin.from('properties').select('id, monthly_rent'),
      supabaseAdmin.from('tenants').select('id'),
      supabaseAdmin
        .from('payments')
        .select('id, amount, paid_on'),
    ]);

    if (landlordsRes.error) throw landlordsRes.error;
    if (propertiesRes.error) throw propertiesRes.error;
    if (tenantsRes.error) throw tenantsRes.error;
    if (paymentsRes.error) throw paymentsRes.error;

    const landlords = (landlordsRes.data || []) as LandlordRow[];
    const properties = (propertiesRes.data || []) as PropertyRow[];
    const tenants = (tenantsRes.data || []) as TenantRow[];
    const payments = (paymentsRes.data || []) as PaymentRow[];

    // --- Core counts ---

    const totalLandlords = landlords.length;
    const totalProperties = properties.length;
    const totalTenants = tenants.length;

    // Sum of all current units' monthly rent
    const totalMonthlyRent = properties.reduce((sum, p) => {
      const rent = typeof p.monthly_rent === 'number' ? p.monthly_rent : 0;
      return sum + rent;
    }, 0);

    // Paid & trial landlords
    const now = new Date();

    let paidLandlords = 0;
    let trialLandlords = 0;

    for (const l of landlords) {
      const status = (l.subscription_status || '').toLowerCase();
      const isPaid =
        status === 'active' || status === 'active_cancel_at_period_end';

      const trialActiveFlag = !!l.trial_active;
      const trialEndDate =
        l.trial_end ? new Date(l.trial_end) : null;
      const inPromoWindow =
        trialEndDate != null && trialEndDate.getTime() > now.getTime();

      const isStripeTrial = status === 'trialing';

      if (isPaid) {
        paidLandlords += 1;
      } else if (isStripeTrial || (trialActiveFlag && inPromoWindow)) {
        trialLandlords += 1;
      }
    }

    // MRR = paid landlords * 29.95
    const MRR = paidLandlords * 29.95;

    // Payments last 30 days
    const thirtyDaysAgo = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 30
    ).getTime();

    const paymentsLast30Days = payments.reduce((sum, p) => {
      if (!p.paid_on) return sum;
      const paidOnTime = new Date(p.paid_on).getTime();
      if (isNaN(paidOnTime) || paidOnTime < thirtyDaysAgo) return sum;

      const amt = typeof p.amount === 'number' ? p.amount : 0;
      return sum + amt;
    }, 0);

    // Respond with the flat metrics object the dashboard expects
    return NextResponse.json(
      {
        totalLandlords,
        totalProperties,
        totalTenants,
        totalMonthlyRent,
        paidLandlords,
        trialLandlords,
        MRR,
        paymentsLast30Days,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[owner metrics] error:', err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          'Unexpected error while loading owner metrics.',
      },
      { status: 500 }
    );
  }
}
