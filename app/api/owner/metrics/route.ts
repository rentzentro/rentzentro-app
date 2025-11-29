// app/api/owner/metrics/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

type LandlordRow = {
  id: number;
  email: string;
  subscription_status: string | null;
  trial_active: boolean | null;
  trial_end: string | null;
};

type PropertyRow = {
  id: number;
  monthly_rent: number | null;
  status: string | null;
};

type TenantRow = {
  id: number;
};

function isTrialLandlord(l: LandlordRow, today: Date) {
  const status = (l.subscription_status || '').toLowerCase();

  // Stripe trial status
  if (status === 'trialing') return true;

  // Your December promo logic: trial_active + trial_end in the future
  if (!l.trial_active || !l.trial_end) return false;

  const end = new Date(l.trial_end);
  if (Number.isNaN(end.getTime())) return false;

  // Compare as date-only
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const todayDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  return endDate >= todayDate;
}

function isPaidLandlord(l: LandlordRow) {
  const status = (l.subscription_status || '').toLowerCase();

  // Treat these as "paid / billing-active" states
  if (
    status === 'active' ||
    status === 'active_cancel_at_period_end' ||
    status === 'past_due' ||
    status === 'unpaid'
  ) {
    return true;
  }

  return false;
}

async function handleMetrics() {
  const today = new Date();

  // 1) Load landlords
  const { data: landlordsData, error: landlordsError } = await supabaseAdmin
    .from('landlords')
    .select('id, email, subscription_status, trial_active, trial_end');

  if (landlordsError) {
    console.error('[owner metrics] Error loading landlords:', landlordsError);
    throw new Error('Unable to load landlord metrics.');
  }

  const landlords = (landlordsData || []) as LandlordRow[];

  // 2) Load properties
  const { data: propertiesData, error: propertiesError } = await supabaseAdmin
    .from('properties')
    .select('id, monthly_rent, status');

  if (propertiesError) {
    console.error('[owner metrics] Error loading properties:', propertiesError);
    throw new Error('Unable to load property metrics.');
  }

  const properties = (propertiesData || []) as PropertyRow[];

  // 3) Load tenants
  const { data: tenantsData, error: tenantsError } = await supabaseAdmin
    .from('tenants')
    .select('id');

  if (tenantsError) {
    console.error('[owner metrics] Error loading tenants:', tenantsError);
    throw new Error('Unable to load tenant metrics.');
  }

  const tenants = (tenantsData || []) as TenantRow[];

  // ---------- Calculations ----------

  const totalLandlords = landlords.length;
  const trialLandlords = landlords.filter((l) => isTrialLandlord(l, today))
    .length;
  const paidLandlords = landlords.filter(isPaidLandlord).length;

  const totalProperties = properties.length;
  const totalMonthlyRent = properties
    .filter((p) => (p.status || '').toLowerCase() === 'current')
    .reduce((sum, p) => sum + (p.monthly_rent || 0), 0);

  const totalTenants = tenants.length;

  return {
    totals: {
      landlords: totalLandlords,
      paidLandlords,
      trialLandlords,
      properties: totalProperties,
      tenants: totalTenants,
      totalMonthlyRent,
    },
  };
}

// Support both GET and POST just in case your dashboard calls either.
export async function GET() {
  try {
    const data = await handleMetrics();
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error('[owner metrics] GET error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to load owner metrics.' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const data = await handleMetrics();
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error('[owner metrics] POST error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to load owner metrics.' },
      { status: 500 }
    );
  }
}
