// app/api/owner/metrics/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

type LandlordRow = {
  id: number;
  subscription_status: string | null;
  trial_active: boolean | null;
  trial_end: string | null;
};

type PropertyRow = {
  id: number;
  monthly_rent: number | null;
};

type TenantRow = {
  id: number;
};

export async function GET() {
  try {
    // ---- Load landlords ----
    const { data: landlords, error: landlordError } = await supabaseAdmin
      .from('landlords')
      .select('id, subscription_status, trial_active, trial_end');

    if (landlordError) {
      console.error('[owner metrics] Error loading landlords:', landlordError);
      return NextResponse.json(
        { error: 'Failed to load landlord metrics.' },
        { status: 500 }
      );
    }

    const landlordList = (landlords || []) as LandlordRow[];

    // ---- Load properties ----
    const { data: properties, error: propertyError } = await supabaseAdmin
      .from('properties')
      .select('id, monthly_rent');

    if (propertyError) {
      console.error('[owner metrics] Error loading properties:', propertyError);
      return NextResponse.json(
        { error: 'Failed to load property metrics.' },
        { status: 500 }
      );
    }

    const propertyList = (properties || []) as PropertyRow[];

    // ---- Load tenants ----
    const { data: tenants, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id');

    if (tenantError) {
      console.error('[owner metrics] Error loading tenants:', tenantError);
      return NextResponse.json(
        { error: 'Failed to load tenant metrics.' },
        { status: 500 }
      );
    }

    const tenantList = (tenants || []) as TenantRow[];

    const now = new Date();

    let totalLandlords = landlordList.length;
    let paidLandlords = 0;
    let trialLandlords = 0;

    landlordList.forEach((ll) => {
      const status = (ll.subscription_status || '').toLowerCase();

      const isPaid =
        status === 'active' ||
        status === 'active_cancel_at_period_end' ||
        status === 'past_due' ||
        status === 'unpaid';

      // promo-style trial (your December promo)
      const isPromoTrial =
        !!ll.trial_active &&
        !!ll.trial_end &&
        new Date(ll.trial_end) >= now;

      // Stripe-style trial
      const isStripeTrial = status === 'trialing';

      if (isPaid) {
        paidLandlords += 1;
      } else if (isPromoTrial || isStripeTrial) {
        // only count as trial if NOT already counted as paid
        trialLandlords += 1;
      }
    });

    const totalProperties = propertyList.length;
    const totalTenants = tenantList.length;

    const totalMonthlyRent = propertyList.reduce((sum, p) => {
      const v = p.monthly_rent ?? 0;
      if (Number.isNaN(v)) return sum;
      return sum + v;
    }, 0);

    return NextResponse.json(
      {
        totalLandlords,
        paidLandlords,
        trialLandlords,
        totalProperties,
        totalTenants,
        totalMonthlyRent,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[owner metrics] Fatal error:', err);
    return NextResponse.json(
      { error: err?.message || 'Unexpected error loading owner metrics.' },
      { status: 500 }
    );
  }
}
