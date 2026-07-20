// app/api/owner/metrics/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../supabaseAdminClient';
import { enforceOwnerApiAccess } from '../../../lib/ownerApiAuth';
import { getRateLimitClientIp, takeRateLimitToken } from '../../../lib/requestRateLimiter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LandlordRow = {
  id: number;
  user_id: string | null;
  name: string | null;
  email: string | null;
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

type ActivationOutreachLandlord = {
  id: number;
  userId: string | null;
  name: string | null;
  email: string | null;
  createdAt: string | null;
  subscriptionStatus: string | null;
  propertyCount: number;
  tenantCount: number;
  missingProperty: boolean;
  missingTenant: boolean;
  daysSinceSignup: number | null;
  lastOutreachAt: string | null;
  lastOutreachSenderLabel: string | null;
  daysSinceLastOutreach: number | null;
  nextFollowUpAt: string | null;
  daysUntilNextFollowUp: number | null;
  followUpCount: number;
  maxFollowUps: number;
  followUpExpired: boolean;
};

type ActivationOutreachEventRow = {
  landlord_id: number;
  sender_label: string | null;
  sent_at: string | null;
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'active_cancel_at_period_end',
]);
const ASSUMED_AVERAGE_PLAN_PRICE = 29.95;
const ACTIVATION_OUTREACH_FOLLOW_UP_DAYS = 5;
const ACTIVATION_OUTREACH_MAX_FOLLOW_UPS = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const safeTime = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

const inferSignupTimeFromTrialEnd = (
  trialEnd: string | null | undefined
): number | null => {
  const trialEndTime = safeTime(trialEnd);
  if (trialEndTime == null) return null;

  const THIRTY_FIVE_DAYS_MS = 35 * 24 * 60 * 60 * 1000;
  return trialEndTime - THIRTY_FIVE_DAYS_MS;
};

const median = (values: number[]): number | null => {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) return sorted[mid];

  return (sorted[mid - 1] + sorted[mid]) / 2;
};

const isMissingActivationOutreachTableError = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '');

  return (
    code === '42P01' ||
    message.includes('owner_activation_outreach_events') ||
    message.includes('could not find the table') ||
    message.includes('does not exist')
  );
};

const loadActivationOutreachEvents = async (): Promise<ActivationOutreachEventRow[]> => {
  const result = await supabaseAdmin
    .from('owner_activation_outreach_events')
    .select('landlord_id, sender_label, sent_at')
    .order('sent_at', { ascending: false });

  if (result.error) {
    if (isMissingActivationOutreachTableError(result.error)) {
      console.warn(
        '[owner metrics] owner_activation_outreach_events table is unavailable; outreach snooze data will be empty.'
      );
      return [];
    }

    throw result.error;
  }

  return (result.data || []) as ActivationOutreachEventRow[];
};

const loadLandlords = async (): Promise<LandlordRow[]> => {
  const withCreatedAt = await supabaseAdmin
    .from('landlords')
    .select(
      'id, user_id, name, email, created_at, subscription_status, trial_active, trial_end, stripe_connect_onboarded'
    );

  if (!withCreatedAt.error) {
    return (withCreatedAt.data || []) as LandlordRow[];
  }

  const createdAtMissing =
    typeof withCreatedAt.error.message === 'string' &&
    withCreatedAt.error.message.toLowerCase().includes('created_at');

  if (!createdAtMissing) {
    throw withCreatedAt.error;
  }

  const withoutCreatedAt = await supabaseAdmin
    .from('landlords')
    .select(
      'id, user_id, name, email, subscription_status, trial_active, trial_end, stripe_connect_onboarded'
    );

  if (withoutCreatedAt.error) {
    throw withoutCreatedAt.error;
  }

  return ((withoutCreatedAt.data || []) as LandlordRow[]).map((row) => ({
    ...row,
    created_at: null,
  }));
};

export async function GET(req: Request) {
  const ip = getRateLimitClientIp(req);
  const rate = takeRateLimitToken({
    key: `owner-metrics:${ip}`,
    limit: 90,
    windowMs: 60 * 1000,
  });

  if (!rate.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded for owner metrics.' }, { status: 429 });
  }

  const auth = await enforceOwnerApiAccess({ req, supabaseAdmin });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  try {
    const [landlords, propertiesRes, tenantsRes, paymentsRes, outreachEvents] =
      await Promise.all([
        loadLandlords(),
        supabaseAdmin
          .from('properties')
          .select('id, owner_id, created_at, monthly_rent'),
        supabaseAdmin.from('tenants').select('id, owner_id, created_at'),
        supabaseAdmin.from('payments').select('id, amount, paid_on'),
        loadActivationOutreachEvents(),
      ]);

    if (propertiesRes.error) throw propertiesRes.error;
    if (tenantsRes.error) throw tenantsRes.error;
    if (paymentsRes.error) throw paymentsRes.error;

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

    const MRR = paidLandlords * ASSUMED_AVERAGE_PLAN_PRICE;

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

    const firstPropertyTimeByOwner = new Map<string, number>();
    const propertyCountByOwner = new Map<string, number>();
    for (const property of properties) {
      if (!property.owner_id) continue;

      propertyCountByOwner.set(
        property.owner_id,
        (propertyCountByOwner.get(property.owner_id) || 0) + 1
      );

      const createdAt = safeTime(property.created_at);
      if (createdAt == null) continue;

      const existing = firstPropertyTimeByOwner.get(property.owner_id);
      if (existing == null || createdAt < existing) {
        firstPropertyTimeByOwner.set(property.owner_id, createdAt);
      }
    }

    const firstTenantTimeByOwner = new Map<string, number>();
    const tenantCountByOwner = new Map<string, number>();
    for (const tenant of tenants) {
      if (!tenant.owner_id) continue;

      tenantCountByOwner.set(
        tenant.owner_id,
        (tenantCountByOwner.get(tenant.owner_id) || 0) + 1
      );

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

      const landlordCreatedAt =
        safeTime(landlord.created_at) ??
        inferSignupTimeFromTrialEnd(landlord.trial_end);
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

    const latestOutreachByLandlord = new Map<number, ActivationOutreachEventRow>();
    const outreachCountByLandlord = new Map<number, number>();
    for (const event of outreachEvents) {
      if (event.landlord_id) {
        outreachCountByLandlord.set(
          event.landlord_id,
          (outreachCountByLandlord.get(event.landlord_id) || 0) + 1
        );
      }

      if (!event.landlord_id || !event.sent_at) continue;

      const existing = latestOutreachByLandlord.get(event.landlord_id);
      if (
        !existing?.sent_at ||
        safeTime(event.sent_at)! > (safeTime(existing.sent_at) ?? 0)
      ) {
        latestOutreachByLandlord.set(event.landlord_id, event);
      }
    }

    const activationOutreachLandlords: ActivationOutreachLandlord[] = landlords
      .map((landlord) => {
        const ownerUserId = landlord.user_id;
        const propertyCount = ownerUserId
          ? propertyCountByOwner.get(ownerUserId) || 0
          : 0;
        const tenantCount = ownerUserId ? tenantCountByOwner.get(ownerUserId) || 0 : 0;
        const landlordCreatedAt =
          safeTime(landlord.created_at) ??
          inferSignupTimeFromTrialEnd(landlord.trial_end);

        const latestOutreach = latestOutreachByLandlord.get(landlord.id);
        const followUpCount = outreachCountByLandlord.get(landlord.id) || 0;
        const lastOutreachTime = safeTime(latestOutreach?.sent_at);
        const nextFollowUpTime =
          lastOutreachTime == null
            ? null
            : lastOutreachTime + ACTIVATION_OUTREACH_FOLLOW_UP_DAYS * MS_PER_DAY;

        return {
          id: landlord.id,
          userId: ownerUserId,
          name: landlord.name,
          email: landlord.email,
          createdAt: landlord.created_at,
          subscriptionStatus: landlord.subscription_status,
          propertyCount,
          tenantCount,
          missingProperty: propertyCount === 0,
          missingTenant: tenantCount === 0,
          daysSinceSignup:
            landlordCreatedAt == null
              ? null
              : Math.max(0, Math.floor((now.getTime() - landlordCreatedAt) / MS_PER_DAY)),
          lastOutreachAt: latestOutreach?.sent_at || null,
          lastOutreachSenderLabel: latestOutreach?.sender_label || null,
          daysSinceLastOutreach:
            lastOutreachTime == null
              ? null
              : Math.max(0, Math.floor((now.getTime() - lastOutreachTime) / MS_PER_DAY)),
          nextFollowUpAt:
            nextFollowUpTime == null ? null : new Date(nextFollowUpTime).toISOString(),
          daysUntilNextFollowUp:
            nextFollowUpTime == null
              ? null
              : Math.max(0, Math.ceil((nextFollowUpTime - now.getTime()) / MS_PER_DAY)),
          followUpCount,
          maxFollowUps: ACTIVATION_OUTREACH_MAX_FOLLOW_UPS,
          followUpExpired: followUpCount >= ACTIVATION_OUTREACH_MAX_FOLLOW_UPS,
        };
      })
      .filter((landlord) => landlord.missingProperty || landlord.missingTenant);

    const readyForActivationOutreach = activationOutreachLandlords
      .filter(
        (landlord) =>
          !landlord.followUpExpired &&
          (landlord.daysSinceLastOutreach == null ||
            landlord.daysSinceLastOutreach >= ACTIVATION_OUTREACH_FOLLOW_UP_DAYS)
      )
      .sort((a, b) => {
        const aDays = a.daysSinceSignup ?? -1;
        const bDays = b.daysSinceSignup ?? -1;
        if (aDays !== bDays) return bDays - aDays;
        return a.id - b.id;
      });

    const recentlyContactedActivationOutreach = activationOutreachLandlords
      .filter(
        (landlord) =>
          !landlord.followUpExpired &&
          landlord.daysSinceLastOutreach != null &&
          landlord.daysSinceLastOutreach < ACTIVATION_OUTREACH_FOLLOW_UP_DAYS
      )
      .sort((a, b) => {
        const aTime = safeTime(a.lastOutreachAt) ?? 0;
        const bTime = safeTime(b.lastOutreachAt) ?? 0;
        if (aTime !== bTime) return bTime - aTime;
        return a.id - b.id;
      });

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
        activationOutreach: {
          followUpCooldownDays: ACTIVATION_OUTREACH_FOLLOW_UP_DAYS,
          maxFollowUps: ACTIVATION_OUTREACH_MAX_FOLLOW_UPS,
          landlords: readyForActivationOutreach,
          recentlyContacted: recentlyContactedActivationOutreach,
        },
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
