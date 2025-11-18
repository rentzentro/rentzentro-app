'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';

type MetricsState = {
  landlordsCount: number | null;
  tenantsCount: number | null;
  propertiesCount: number | null;
  paymentsCount: number | null;
  totalVolume: number; // total rent processed
  estimatedPlatformRevenue: number; // 2.5% of volume
};

export default function OwnerDashboardPage() {
  const [metrics, setMetrics] = useState<MetricsState>({
    landlordsCount: null,
    tenantsCount: null,
    propertiesCount: null,
    paymentsCount: null,
    totalVolume: 0,
    estimatedPlatformRevenue: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMetrics = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1) Landlords count
        const { count: landlordsCount, error: landlordsError } = await supabase
          .from('landlords')
          .select('*', { count: 'exact', head: true });

        if (landlordsError) throw landlordsError;

        // 2) Tenants count
        const { count: tenantsCount, error: tenantsError } = await supabase
          .from('tenants')
          .select('*', { count: 'exact', head: true });

        if (tenantsError) throw tenantsError;

        // 3) Properties count
        const { count: propertiesCount, error: propertiesError } =
          await supabase
            .from('properties')
            .select('*', { count: 'exact', head: true });

        if (propertiesError) throw propertiesError;

        // 4) Payments count + total volume
        const { data: paymentsData, error: paymentsError, count: paymentsCount } =
          await supabase
            .from('payments')
            .select('id, amount', { count: 'exact' });

        if (paymentsError) throw paymentsError;

        const totalVolume =
          (paymentsData || []).reduce((sum, p) => {
            const amt = typeof p.amount === 'number' ? p.amount : 0;
            return sum + amt;
          }, 0) || 0;

        const estimatedPlatformRevenue = totalVolume * 0.025; // 2.5%

        setMetrics({
          landlordsCount: landlordsCount ?? 0,
          tenantsCount: tenantsCount ?? 0,
          propertiesCount: propertiesCount ?? 0,
          paymentsCount: paymentsCount ?? 0,
          totalVolume,
          estimatedPlatformRevenue,
        });
      } catch (err: any) {
        console.error('Error loading owner metrics:', err);
        setError(
          err?.message ||
            'Something went wrong loading owner dashboard metrics.'
        );
      } finally {
        setLoading(false);
      }
    };

    loadMetrics();
  }, []);

  const fmtInt = (value: number | null) =>
    value == null ? '—' : value.toLocaleString();

  const fmtMoney = (value: number) =>
    `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-10">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.18em]">
              OWNER DASHBOARD
            </p>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-50">
              RentZentro overview
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Private metrics only you can see: landlords, tenants, portfolio,
              and payment volume.
            </p>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-rose-500/70 bg-rose-950/50 px-4 py-3 text-sm text-rose-50">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <p className="text-sm text-slate-400">Loading your metrics…</p>
        ) : (
          <div className="space-y-6">
            {/* Top metrics row */}
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl bg-slate-950 border border-slate-800/80 p-4">
                <p className="text-[11px] text-slate-500 uppercase tracking-[0.18em] mb-1">
                  LANDLORDS
                </p>
                <p className="text-2xl font-semibold text-slate-50">
                  {fmtInt(metrics.landlordsCount)}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Active landlord accounts
                </p>
              </div>

              <div className="rounded-2xl bg-slate-950 border border-slate-800/80 p-4">
                <p className="text-[11px] text-slate-500 uppercase tracking-[0.18em] mb-1">
                  TENANTS
                </p>
                <p className="text-2xl font-semibold text-slate-50">
                  {fmtInt(metrics.tenantsCount)}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Tenants in the system
                </p>
              </div>

              <div className="rounded-2xl bg-slate-950 border border-slate-800/80 p-4">
                <p className="text-[11px] text-slate-500 uppercase tracking-[0.18em] mb-1">
                  PROPERTIES
                </p>
                <p className="text-2xl font-semibold text-slate-50">
                  {fmtInt(metrics.propertiesCount)}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Units being tracked
                </p>
              </div>

              <div className="rounded-2xl bg-slate-950 border border-slate-800/80 p-4">
                <p className="text-[11px] text-slate-500 uppercase tracking-[0.18em] mb-1">
                  PAYMENTS
                </p>
                <p className="text-2xl font-semibold text-slate-50">
                  {fmtInt(metrics.paymentsCount)}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Total payments recorded
                </p>
              </div>
            </div>

            {/* Volume row */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-950 border border-slate-800/80 p-5">
                <p className="text-[11px] text-slate-500 uppercase tracking-[0.18em] mb-1">
                  TOTAL RENT VOLUME
                </p>
                <p className="text-3xl font-semibold text-emerald-300">
                  {fmtMoney(metrics.totalVolume)}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  All-time processed through RentZentro (test + live).
                </p>
              </div>

              <div className="rounded-2xl bg-slate-950 border border-slate-800/80 p-5">
                <p className="text-[11px] text-slate-500 uppercase tracking-[0.18em] mb-1">
                  EST. PLATFORM REVENUE
                </p>
                <p className="text-3xl font-semibold text-slate-50">
                  {fmtMoney(metrics.estimatedPlatformRevenue)}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Estimated at 2.5% per payment. Live mode will reflect real
                  revenue as you onboard landlords.
                </p>
              </div>
            </div>

            {/* Note */}
            <p className="text-[11px] text-slate-500">
              This page is not linked anywhere public. It&apos;s your private
              owner view. Later we can add monthly charts, churn, per-landlord
              stats, and live vs. test filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
