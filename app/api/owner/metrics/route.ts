// app/api/owner/metrics/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../supabaseAdminClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LandlordRow = {
  id: number;
  user_id: string | null;
  created_at: string | null;
  subscription_status: string | null;
  trial_active?: boolean | null;
  trial_end?: string | null;
  stripe_connect_onboarded?: boolean | null;
};

type PropertyRow = {
  id: number;
  owner_id: string | null;
  created_at: string | null;
  monthly_rent: number | null;
};

type TenantRow = {
  id: number;
  owner_id: string | null;
  created_at: string | null;
};

type PaymentRow = {
  id: number;
  amount: number | null;
  paid_on: string | null;
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'active_cancel_at_period_end',
]);

const safeTime = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

const median = (values: number[]): number | null => {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) return sorted[mid];

  return (sorted[mid - 1] + sorted[mid]) / 2;
};

export async function GET() {
  try {
    const [landlordsRes, propertiesRes, tenantsRes, paymentsRes] =
      await Promise.all([
        supabaseAdmin
          .from('landlords')
          .select(
            'id, user_id, created_at, subscription_status, trial_active, trial_end, stripe_connect_onboarded'
          ),
        supabaseAdmin
          .from('properties')
          .select('id, owner_id, created_at, monthly_rent'),
        supabaseAdmin.from('tenants').select('id, owner_id, created_at'),
        supabaseAdmin.from('payments').select('id, amount, paid_on'),
      ]);

    if (landlordsRes.error) throw landlordsRes.error;
    if (propertiesRes.error) throw propertiesRes.error;
    if (tenantsRes.error) throw tenantsRes.error;
    if (paymentsRes.error) throw paymentsRes.error;

    const landlords = (landlordsRes.data || []) as LandlordRow[];
    const properties = (propertiesRes.data || []) as PropertyRow[];
    const tenants = (tenantsRes.data || []) as TenantRow[];
    const payments = (paymentsRes.data || []) as PaymentRow[];

    const totalLandlords = landlords.length;
    const totalProperties = properties.length;
    const totalTenants = tenants.length;

    const totalMonthlyRent = properties.reduce((sum, p) => {
      const rent = typeof p.monthly_rent === 'number' ? p.monthly_rent : 0;
      return sum + rent;
    }, 0);

    const now = new Date();

    let paidLandlords = 0;
    let trialLandlords = 0;

    for (const l of landlords) {
      const status = (l.subscription_status || '').toLowerCase();
      const isPaid = ACTIVE_SUBSCRIPTION_STATUSES.has(status);

      const trialActiveFlag = !!l.trial_active;
      const trialEndDate = l.trial_end ? new Date(l.trial_end) : null;
      const inPromoWindow =
        trialEndDate != null && trialEndDate.getTime() > now.getTime();

      const isStripeTrial = status === 'trialing';

      if (isPaid) {
        paidLandlords += 1;
      } else if (isStripeTrial || (trialActiveFlag && inPromoWindow)) {
        trialLandlords += 1;
      }
    }

    const MRR = paidLandlords * 29.95;

    const thirtyDaysAgo = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 30
    ).getTime();

    const paymentsLast30Days = payments.reduce((sum, p) => {
      if (!p.paid_on) return sum;
      const paidOnTime = new Date(p.paid_on).getTime();
      if (Number.isNaN(paidOnTime) || paidOnTime < thirtyDaysAgo) return sum;

      const amt = typeof p.amount === 'number' ? p.amount : 0;
      return sum + amt;
    }, 0);

    // --- Activation funnel instrumentation (derived from production data) ---

    const firstPropertyTimeByOwner = new Map<string, number>();
    for (const property of properties) {
      if (!property.owner_id) continue;
      const createdAt = safeTime(property.created_at);
      if (createdAt == null) continue;

      const existing = firstPropertyTimeByOwner.get(property.owner_id);
      if (existing == null || createdAt < existing) {
        firstPropertyTimeByOwner.set(property.owner_id, createdAt);
      }
    }

    const firstTenantTimeByOwner = new Map<string, number>();
    for (const tenant of tenants) {
      if (!tenant.owner_id) continue;
      const createdAt = safeTime(tenant.created_at);
      if (createdAt == null) continue;

      const existing = firstTenantTimeByOwner.get(tenant.owner_id);
      if (existing == null || createdAt < existing) {
        firstTenantTimeByOwner.set(tenant.owner_id, createdAt);
      }
    }

    let funnelSignup = 0;
    let funnelConnectedPayouts = 0;
    let funnelFirstProperty = 0;
    let funnelFirstTenant = 0;
    let funnelPaidSubscription = 0;

    const hoursToFirstProperty: number[] = [];
    const hoursToFirstTenant: number[] = [];

    for (const landlord of landlords) {
      funnelSignup += 1;

      const status = (landlord.subscription_status || '').toLowerCase();
      if (ACTIVE_SUBSCRIPTION_STATUSES.has(status)) {
        funnelPaidSubscription += 1;
      }

      if (landlord.stripe_connect_onboarded === true) {
        funnelConnectedPayouts += 1;
      }

      const ownerUserId = landlord.user_id;
      if (!ownerUserId) continue;

      const firstPropertyTime = firstPropertyTimeByOwner.get(ownerUserId);
      if (firstPropertyTime != null) {
        funnelFirstProperty += 1;
      }

      const firstTenantTime = firstTenantTimeByOwner.get(ownerUserId);
      if (firstTenantTime != null) {
        funnelFirstTenant += 1;
      }

      const landlordCreatedAt = safeTime(landlord.created_at);
      if (landlordCreatedAt == null) continue;

      if (firstPropertyTime != null && firstPropertyTime >= landlordCreatedAt) {
        hoursToFirstProperty.push(
          (firstPropertyTime - landlordCreatedAt) / (1000 * 60 * 60)
        );
      }

      if (firstTenantTime != null && firstTenantTime >= landlordCreatedAt) {
        hoursToFirstTenant.push(
          (firstTenantTime - landlordCreatedAt) / (1000 * 60 * 60)
        );
      }
    }

    const activationFunnel = {
      signup: funnelSignup,
      connectedPayouts: funnelConnectedPayouts,
      firstProperty: funnelFirstProperty,
      firstTenant: funnelFirstTenant,
      paidSubscription: funnelPaidSubscription,
      conversionRates: {
        signupToProperty:
          funnelSignup > 0 ? funnelFirstProperty / funnelSignup : 0,
        propertyToTenant:
          funnelFirstProperty > 0 ? funnelFirstTenant / funnelFirstProperty : 0,
        tenantToPaid:
          funnelFirstTenant > 0 ? funnelPaidSubscription / funnelFirstTenant : 0,
        signupToPaid:
          funnelSignup > 0 ? funnelPaidSubscription / funnelSignup : 0,
      },
      medianHours: {
        signupToFirstProperty: median(hoursToFirstProperty),
        signupToFirstTenant: median(hoursToFirstTenant),
      },
      opportunities: {
        signupNoProperty: Math.max(funnelSignup - funnelFirstProperty, 0),
        propertyNoTenant: Math.max(funnelFirstProperty - funnelFirstTenant, 0),
        tenantNoPaid: Math.max(funnelFirstTenant - funnelPaidSubscription, 0),
      },
    };

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
        activationFunnel,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[owner metrics] error:', err);
    return NextResponse.json(
      {
        error: err?.message || 'Unexpected error while loading owner metrics.',
      },
      { status: 500 }
    );
  }
}
