// app/owner/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const OWNER_API_TOKEN = process.env.NEXT_PUBLIC_OWNER_API_TOKEN || '';
type OutreachSender = 'support' | 'bradley';

type OwnerDashboardActivationOutreachLandlord = {
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
};

type OwnerMetrics = {
  totalLandlords: number;
  totalProperties: number;
  totalTenants: number;
  totalMonthlyRent: number;
  paidLandlords: number;
  trialLandlords: number;
  MRR: number;
  paymentsLast30Days: number;
  activationOutreach: {
    landlords: OwnerDashboardActivationOutreachLandlord[];
  };
  activationFunnel: {
    signup: number;
    connectedPayouts: number;
    firstProperty: number;
    firstTenant: number;
    paidSubscription: number;
    conversionRates: {
      signupToProperty: number;
      propertyToTenant: number;
      tenantToPaid: number;
      signupToPaid: number;
    };
    medianHours: {
      signupToFirstProperty: number | null;
      signupToFirstTenant: number | null;
    };
    opportunities: {
      signupNoProperty: number;
      propertyNoTenant: number;
      tenantNoPaid: number;
    };
  };
};


type ReferralSummary = {
  totalReferralEvents: number;
  totalRewards: number;
  pendingRewards: number;
  pendingRewardAmountCents: number;
};

const formatCurrency = (value: number | null | undefined) => {
  if (value == null || isNaN(value)) return '-';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
};


const formatPercent = (value: number | null | undefined) => {
  if (value == null || isNaN(value)) return '-';
  return `${(value * 100).toFixed(1)}%`;
};

const formatHours = (value: number | null | undefined) => {
  if (value == null || isNaN(value)) return '-';
  if (value < 24) return `${value.toFixed(1)} hrs`;
  return `${(value / 24).toFixed(1)} days`;
};

const buildGmailHelpEmailHref = (
  landlord: OwnerDashboardActivationOutreachLandlord,
  fromEmail = DEFAULT_OUTREACH_GMAIL_ACCOUNT
) => {
  if (!landlord.email) return '#';

  const missingSteps = [
    landlord.missingProperty ? 'property' : null,
    landlord.missingTenant ? 'tenant' : null,
  ].filter(Boolean);
  const subject = 'Can I help you finish setting up RentZentro?';
  const greeting = landlord.name ? `Hi ${landlord.name},` : 'Hi there,';
  const body = `${greeting}

I noticed you signed up for RentZentro but have not added a ${missingSteps.join(
    ' or '
  )} yet. Do you need any help getting your account set up?

I can walk you through adding your first property, inviting a tenant, or answering any questions.

Best,
RentZentro Team`;

  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    tf: '1',
    to: landlord.email,
    su: subject,
    body,
    authuser: fromEmail,
  });

  // Put the selected Google account in Gmail's `/u/{account}/` path instead
  // of relying only on `authuser`; mobile browsers/apps are more likely to
  // honor this path and land directly in that account's compose screen.
  return `https://mail.google.com/mail/u/${encodeURIComponent(
    fromEmail
  )}/?${params.toString()}`;
};


export default function OwnerDashboardPage() {
  const [metrics, setMetrics] = useState<OwnerMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referralSummary, setReferralSummary] = useState<ReferralSummary | null>(null);
  const [sendingOutreachKey, setSendingOutreachKey] = useState<string | null>(null);
  const [outreachNotice, setOutreachNotice] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const headers = OWNER_API_TOKEN ? { 'x-owner-api-key': OWNER_API_TOKEN } : undefined;

        const [metricsRes, referralsRes] = await Promise.all([
          fetch('/api/owner/metrics', {
            cache: 'no-store',
            headers,
          }),
          fetch('/api/owner/referrals', {
            cache: 'no-store',
            headers,
          }),
        ]);

        const raw = await metricsRes.json().catch(() => ({}));

        if (!metricsRes.ok) {
          throw new Error(raw?.error || 'Failed to load owner metrics.');
        }

        const referralRaw = await referralsRes.json().catch(() => ({}));

        if (referralsRes.ok) {
          setReferralSummary({
            totalReferralEvents: Number(referralRaw?.summary?.totalReferralEvents ?? 0),
            totalRewards: Number(referralRaw?.summary?.totalRewards ?? 0),
            pendingRewards: Number(referralRaw?.summary?.rewardStatus?.pending ?? 0),
            pendingRewardAmountCents: Number(referralRaw?.summary?.pendingRewardAmountCents ?? 0),
          });
        }

        // Allow either { metrics: {...} } or {...}
        const src: any = raw && raw.metrics ? raw.metrics : raw;

        const cleaned: OwnerMetrics = {
          totalLandlords: Number(src.totalLandlords ?? 0),
          totalProperties: Number(src.totalProperties ?? 0),
          totalTenants: Number(src.totalTenants ?? 0),
          totalMonthlyRent: Number(src.totalMonthlyRent ?? 0),
          paidLandlords: Number(src.paidLandlords ?? 0),
          trialLandlords: Number(src.trialLandlords ?? 0),
          MRR: Number(src.MRR ?? 0),
          paymentsLast30Days: Number(src.paymentsLast30Days ?? 0),
          activationOutreach: {
            landlords: Array.isArray(src.activationOutreach?.landlords)
              ? src.activationOutreach.landlords.map((landlord: any) => ({
                  id: Number(landlord.id ?? 0),
                  userId: landlord.userId ?? null,
                  name: landlord.name ?? null,
                  email: landlord.email ?? null,
                  createdAt: landlord.createdAt ?? null,
                  subscriptionStatus: landlord.subscriptionStatus ?? null,
                  propertyCount: Number(landlord.propertyCount ?? 0),
                  tenantCount: Number(landlord.tenantCount ?? 0),
                  missingProperty: Boolean(landlord.missingProperty),
                  missingTenant: Boolean(landlord.missingTenant),
                  daysSinceSignup:
                    landlord.daysSinceSignup == null
                      ? null
                      : Number(landlord.daysSinceSignup),
                }))
              : [],
          },
          activationFunnel: {
            signup: Number(src.activationFunnel?.signup ?? 0),
            connectedPayouts: Number(src.activationFunnel?.connectedPayouts ?? 0),
            firstProperty: Number(src.activationFunnel?.firstProperty ?? 0),
            firstTenant: Number(src.activationFunnel?.firstTenant ?? 0),
            paidSubscription: Number(src.activationFunnel?.paidSubscription ?? 0),
            conversionRates: {
              signupToProperty: Number(src.activationFunnel?.conversionRates?.signupToProperty ?? 0),
              propertyToTenant: Number(src.activationFunnel?.conversionRates?.propertyToTenant ?? 0),
              tenantToPaid: Number(src.activationFunnel?.conversionRates?.tenantToPaid ?? 0),
              signupToPaid: Number(src.activationFunnel?.conversionRates?.signupToPaid ?? 0),
            },
            medianHours: {
              signupToFirstProperty:
                src.activationFunnel?.medianHours?.signupToFirstProperty == null
                  ? null
                  : Number(src.activationFunnel?.medianHours?.signupToFirstProperty),
              signupToFirstTenant:
                src.activationFunnel?.medianHours?.signupToFirstTenant == null
                  ? null
                  : Number(src.activationFunnel?.medianHours?.signupToFirstTenant),
            },
            opportunities: {
              signupNoProperty: Number(src.activationFunnel?.opportunities?.signupNoProperty ?? 0),
              propertyNoTenant: Number(src.activationFunnel?.opportunities?.propertyNoTenant ?? 0),
              tenantNoPaid: Number(src.activationFunnel?.opportunities?.tenantNoPaid ?? 0),
            },
          },
        };

        setMetrics(cleaned);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message || 'Unable to load owner dashboard metrics right now.'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const sendActivationOutreachEmail = async (
    landlord: OwnerDashboardActivationOutreachLandlord,
    sender: OutreachSender
  ) => {
    if (!landlord.email) return;

    const senderLabel = sender === 'bradley' ? 'Bradley' : 'support';
    const confirmed = window.confirm(
      `Send this pre-written setup help email to ${landlord.email} from ${senderLabel}?`
    );

    if (!confirmed) return;

    const requestKey = `${landlord.id}:${sender}`;
    setSendingOutreachKey(requestKey);
    setOutreachNotice(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (OWNER_API_TOKEN) {
        headers['x-owner-api-key'] = OWNER_API_TOKEN;
      }

      const res = await fetch('/api/owner/activation-outreach-email', {
        method: 'POST',
        cache: 'no-store',
        headers,
        body: JSON.stringify({ landlordId: landlord.id, sender }),
      });
      const raw = await res.json().catch(() => ({}));

      if (!res.ok || raw?.ok === false) {
        throw new Error(raw?.error || 'Unable to send activation outreach email.');
      }

      setOutreachNotice(
        `Sent setup help email to ${landlord.email} from ${
          raw?.senderLabel || senderLabel
        }.`
      );
    } catch (err: any) {
      setOutreachNotice(
        err?.message || 'Unable to send activation outreach email.'
      );
    } finally {
      setSendingOutreachKey(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] text-slate-500 uppercase tracking-wide">
              RentZentro owner view
            </p>
            <h1 className="text-xl font-semibold text-slate-50">
              Platform overview
            </h1>
            <p className="text-xs text-slate-400">
              High-level metrics across all landlords, properties, and payments.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end text-xs">
            <Link
              href="/"
              className="rz-btn-nav"
            >
              Back to marketing site
            </Link>
            <Link
              href="/owner/referrals"
              className="rz-btn-nav"
            >
              Referral rewards
            </Link>
            <Link
              href="/landlord"
              className="rz-btn-nav"
            >
              Landlord dashboard
            </Link>
          </div>
        </header>

        {/* Error / loading */}
        {loading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-400">
            Loading owner metrics…
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        {/* Content */}
        {metrics && !loading && !error && (
          <>
            {/* Top stats */}
            <section className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                  Total landlords
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-50">
                  {metrics.totalLandlords}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Accounts created in RentZentro.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                  Total properties
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-50">
                  {metrics.totalProperties}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Units currently tracked.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                  Total tenants
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-50">
                  {metrics.totalTenants}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Tenant records in the system.
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-4">
                <p className="text-[11px] text-emerald-300 uppercase tracking-wide">
                  Total monthly rent
                </p>
                <p className="mt-2 text-2xl font-semibold text-emerald-300">
                  {formatCurrency(metrics.totalMonthlyRent)}
                </p>
                <p className="mt-1 text-[11px] text-emerald-100/80">
                  Sum of current units&apos; monthly rent.
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wide">Referral program</p>
                  <h2 className="mt-1 text-sm font-semibold text-slate-50">Reward pipeline snapshot</h2>
                </div>
                <Link href="/owner/referrals" className="rz-btn-nav text-xs">
                  Open referral queue
                </Link>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-4 text-xs">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                  <p className="text-slate-500">Events</p>
                  <p className="mt-1 text-slate-100 font-semibold">{referralSummary?.totalReferralEvents ?? 0}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                  <p className="text-slate-500">Rewards</p>
                  <p className="mt-1 text-slate-100 font-semibold">{referralSummary?.totalRewards ?? 0}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                  <p className="text-slate-500">Pending rewards</p>
                  <p className="mt-1 text-amber-300 font-semibold">{referralSummary?.pendingRewards ?? 0}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                  <p className="text-slate-500">Pending payout</p>
                  <p className="mt-1 text-emerald-300 font-semibold">
                    {formatCurrency((referralSummary?.pendingRewardAmountCents ?? 0) / 100)}
                  </p>
                </div>
              </div>
            </section>

            {/* Subscription breakdown + revenue */}
            <section className="grid gap-4 md:grid-cols-[1.3fr_1.3fr]">
              {/* Subscriptions */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                      Landlords by plan status
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-50">
                      Paid vs trialing
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 text-[11px] sm:grid-cols-2">
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-3 py-2">
                    <p className="text-emerald-200 font-semibold">
                      Paid landlords
                    </p>
                    <p className="mt-1 text-xl font-semibold text-emerald-300">
                      {metrics.paidLandlords}
                    </p>
                    <p className="mt-1 text-slate-400">
                      Subscription status: active / active_cancel_at_period_end.
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-3 py-2">
                    <p className="text-amber-200 font-semibold">
                      Trial landlords
                    </p>
                    <p className="mt-1 text-xl font-semibold text-amber-200">
                      {metrics.trialLandlords}
                    </p>
                    <p className="mt-1 text-slate-400">
                      Subscription status: trialing.
                    </p>
                  </div>
                </div>
              </div>

              {/* Revenue */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
                <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                  Revenue overview
                </p>
                <div className="grid gap-3 text-[11px] sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2">
                    <p className="text-slate-200 font-semibold">
                      Estimated MRR
                    </p>
                    <p className="mt-1 text-xl font-semibold text-slate-50">
                      {formatCurrency(metrics.MRR)}
                    </p>
                    <p className="mt-1 text-slate-400">
                      {metrics.paidLandlords} paid landlords × assumed blended rate ($29.95/month).
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2">
                    <p className="text-slate-200 font-semibold">
                      Rent processed (30 days)
                    </p>
                    <p className="mt-1 text-xl font-semibold text-slate-50">
                      {formatCurrency(metrics.paymentsLast30Days)}
                    </p>
                    <p className="mt-1 text-slate-400">
                      Total tenant payments recorded in last 30 days.
                    </p>
                  </div>
                </div>
              </div>
            </section>



            <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-4">
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                  Landlord activation funnel
                </p>
                <p className="mt-1 text-sm font-medium text-slate-50">
                  End-to-end onboarding performance
                </p>
              </div>

              <div className="grid gap-3 text-[11px] sm:grid-cols-5">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <p className="text-slate-300 font-semibold">Signup</p>
                  <p className="mt-1 text-lg font-semibold text-slate-50">{metrics.activationFunnel.signup}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <p className="text-slate-300 font-semibold">Payouts connected</p>
                  <p className="mt-1 text-lg font-semibold text-slate-50">{metrics.activationFunnel.connectedPayouts}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <p className="text-slate-300 font-semibold">First property</p>
                  <p className="mt-1 text-lg font-semibold text-slate-50">{metrics.activationFunnel.firstProperty}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <p className="text-slate-300 font-semibold">First tenant</p>
                  <p className="mt-1 text-lg font-semibold text-slate-50">{metrics.activationFunnel.firstTenant}</p>
                </div>
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-3 py-2">
                  <p className="text-emerald-200 font-semibold">Paid subscription</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-300">{metrics.activationFunnel.paidSubscription}</p>
                </div>
              </div>

              <div className="grid gap-3 text-[11px] sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <p className="text-slate-300">Signup → property</p>
                  <p className="mt-1 text-base font-semibold text-slate-50">{formatPercent(metrics.activationFunnel.conversionRates.signupToProperty)}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <p className="text-slate-300">Property → tenant</p>
                  <p className="mt-1 text-base font-semibold text-slate-50">{formatPercent(metrics.activationFunnel.conversionRates.propertyToTenant)}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <p className="text-slate-300">Tenant → paid</p>
                  <p className="mt-1 text-base font-semibold text-slate-50">{formatPercent(metrics.activationFunnel.conversionRates.tenantToPaid)}</p>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-3 py-2">
                  <p className="text-emerald-200">Signup → paid</p>
                  <p className="mt-1 text-base font-semibold text-emerald-300">{formatPercent(metrics.activationFunnel.conversionRates.signupToPaid)}</p>
                </div>
              </div>

              <div className="grid gap-3 text-[11px] sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <p className="text-slate-300">Median signup → property</p>
                  <p className="mt-1 text-base font-semibold text-slate-50">{formatHours(metrics.activationFunnel.medianHours.signupToFirstProperty)}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <p className="text-slate-300">Median signup → tenant</p>
                  <p className="mt-1 text-base font-semibold text-slate-50">{formatHours(metrics.activationFunnel.medianHours.signupToFirstTenant)}</p>
                </div>
                <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 px-3 py-2">
                  <p className="text-rose-200">Signup without property</p>
                  <p className="mt-1 text-base font-semibold text-rose-100">{metrics.activationFunnel.opportunities.signupNoProperty}</p>
                </div>
                <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 px-3 py-2">
                  <p className="text-rose-200">Property without tenant</p>
                  <p className="mt-1 text-base font-semibold text-rose-100">{metrics.activationFunnel.opportunities.propertyNoTenant}</p>
                </div>
                <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 px-3 py-2">
                  <p className="text-rose-200">Tenant not paid</p>
                  <p className="mt-1 text-base font-semibold text-rose-100">{metrics.activationFunnel.opportunities.tenantNoPaid}</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                    Activation outreach
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-50">
                    Landlords missing a property or tenant
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Send a pre-written setup help email from support@rentzentro.com or bradley@rentzentro.com without using your personal Gmail.
                  </p>
                </div>
                <div className="rounded-full border border-rose-500/30 bg-rose-950/30 px-3 py-1 text-xs font-semibold text-rose-100">
                  {metrics.activationOutreach.landlords.length} need follow-up
                </div>
              </div>

              {outreachNotice && (
                <div className="rounded-xl border border-sky-500/30 bg-sky-950/30 px-3 py-2 text-xs text-sky-100">
                  {outreachNotice}
                </div>
              )}

              {metrics.activationOutreach.landlords.length === 0 ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-3 py-3 text-xs text-emerald-100">
                  Every landlord has added at least one property and one tenant.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-800">
                  <div className="hidden grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.9fr_1.2fr] gap-3 border-b border-slate-800 bg-slate-900/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid">
                    <span>Landlord</span>
                    <span>Missing</span>
                    <span>Properties</span>
                    <span>Tenants</span>
                    <span>Signed up</span>
                    <span>Email</span>
                  </div>
                  <div className="divide-y divide-slate-800">
                    {metrics.activationOutreach.landlords.map((landlord) => {
                      const missingLabel = [
                        landlord.missingProperty ? 'Property' : null,
                        landlord.missingTenant ? 'Tenant' : null,
                      ]
                        .filter(Boolean)
                        .join(' + ');
                      const canEmail = Boolean(landlord.email);

                      return (
                        <div
                          key={landlord.id}
                          className={`grid gap-2 px-3 py-3 text-xs md:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.9fr_1.2fr] md:items-center md:gap-3 ${
                            canEmail ? 'bg-slate-950/70' : 'bg-slate-950/50 opacity-70'
                          }`}
                        >
                          <div>
                            <p className="font-semibold text-slate-100">
                              {landlord.name || landlord.email || `Landlord #${landlord.id}`}
                            </p>
                            <p className="mt-0.5 text-slate-500">
                              {landlord.email || 'No email on landlord record'}
                            </p>
                          </div>
                          <div>
                            <span className="inline-flex rounded-full border border-rose-500/30 bg-rose-950/30 px-2 py-1 font-semibold text-rose-100">
                              {missingLabel}
                            </span>
                          </div>
                          <p className="text-slate-300">{landlord.propertyCount}</p>
                          <p className="text-slate-300">{landlord.tenantCount}</p>
                          <p className="text-slate-400">
                            {landlord.daysSinceSignup == null
                              ? 'Unknown'
                              : `${landlord.daysSinceSignup} days ago`}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {canEmail ? (
                              <>
                                <button
                                  type="button"
                                  disabled={sendingOutreachKey != null}
                                  onClick={() =>
                                    sendActivationOutreachEmail(landlord, 'support')
                                  }
                                  className="rounded-full border border-emerald-500/40 bg-emerald-950/40 px-3 py-1 font-semibold text-emerald-100 transition hover:bg-emerald-900/60 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {sendingOutreachKey === `${landlord.id}:support`
                                    ? 'Sending…'
                                    : 'Send from support'}
                                </button>
                                <button
                                  type="button"
                                  disabled={sendingOutreachKey != null}
                                  onClick={() =>
                                    sendActivationOutreachEmail(landlord, 'bradley')
                                  }
                                  className="rounded-full border border-sky-500/40 bg-sky-950/40 px-3 py-1 font-semibold text-sky-100 transition hover:bg-sky-900/60 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {sendingOutreachKey === `${landlord.id}:bradley`
                                    ? 'Sending…'
                                    : 'Send from Bradley'}
                                </button>
                              </>
                            ) : (
                              <span className="text-slate-500">Add email first</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* Notes */}
            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-[11px] text-slate-400">
              <p className="font-semibold text-slate-200 mb-1">
                How to use this dashboard
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  Watch <span className="text-slate-200">total landlords</span>{' '}
                  and <span className="text-slate-200">paid landlords</span> to
                  track growth.
                </li>
                <li>
                  <span className="text-slate-200">Total monthly rent</span> and{' '}
                  <span className="text-slate-200">
                    rent processed last 30 days
                  </span>{' '}
                  show how much volume is flowing through RentZentro.
                </li>
                <li>
                  As you improve onboarding and marketing, you should see{' '}
                  <span className="text-slate-200">trial → paid</span>{' '}
                  conversion increase and MRR climb.
                </li>
              </ul>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
