'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

type TenantRow = {
  id: number;
  created_at: string;
  name: string | null;
  email: string;
  phone: string | null;
  property_id: number | null;
  monthly_rent: number | null;
  status: string | null;
  lease_start: string | null;
  lease_end: string | null;
};

type PropertyRow = {
  id: number;
  created_at: string;
  name: string | null; // property name / address
  unit_label: string | null;
  monthly_rent: number | null;
  status: string | null;
  next_due_date: string | null;
};

export default function TenantPortalPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [property, setProperty] = useState<PropertyRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---------- AUTH + LOAD TENANT ----------
  useEffect(() => {
    const loadTenant = async () => {
      setLoading(true);
      setError(null);

      // 1. Get current session
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Tenant portal – session error:', sessionError);
        setError('Problem checking your login. Please try again.');
        setLoading(false);
        return;
      }

      if (!session?.user) {
        // Not logged in → go to tenant login
        router.push('/tenant/login');
        return;
      }

      const email = session.user.email?.toLowerCase().trim();
      if (!email) {
        setError('Your account does not have an email associated with it.');
        setLoading(false);
        return;
      }

      // 2. Find matching tenant row by email
      const { data: tenantRow, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (tenantError) {
        console.error('Tenant portal – tenant query error:', tenantError);
        setError('There was a problem loading your tenant account.');
        setLoading(false);
        return;
      }

      if (!tenantRow) {
        setError(
          'No tenant account found for this email. Please ask your landlord to add you to RentZentro.'
        );
        setLoading(false);
        return;
      }

      setTenant(tenantRow as TenantRow);

      // 3. Optionally load property details
      if (tenantRow.property_id) {
        const { data: propertyRow, error: propertyError } = await supabase
          .from('properties')
          .select('*')
          .eq('id', tenantRow.property_id)
          .maybeSingle();

        if (propertyError) {
          console.error('Tenant portal – property query error:', propertyError);
        } else {
          setProperty(propertyRow as PropertyRow);
        }
      }

      setLoading(false);
    };

    loadTenant();
  }, [router]);

  // ---------- HELPERS ----------

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return value;
    }
  };

  const nextDue = property?.next_due_date
    ? formatDate(property.next_due_date)
    : 'See lease for details';

  const statusBadgeColor =
    tenant?.status?.toLowerCase() === 'current'
      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
      : tenant?.status?.toLowerCase() === 'late'
      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/40'
      : 'bg-slate-500/10 text-slate-300 border border-slate-500/40';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/tenant/login');
  };

  // ---------- UI ----------

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        {/* Top bar */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-slate-400 transition hover:text-slate-100"
          >
            <span className="mr-2 text-lg">←</span>
            Back to home
          </Link>

          <button
            onClick={handleLogout}
            className="rounded-full border border-slate-600 bg-slate-900 px-4 py-1.5 text-sm font-medium text-slate-100 shadow-sm transition hover:border-rose-500 hover:text-rose-100"
          >
            Log out
          </button>
        </div>

        {/* Header */}
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Tenant Portal
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
            {tenant ? `Welcome, ${tenant.name || 'tenant'}` : 'Your rent hub'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            View your rent, lease details, and payment status in one simple dashboard.
          </p>
        </header>

        {/* Loading / Error / Empty states */}
        {loading && (
          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-300">
            Loading your account…
          </div>
        )}

        {!loading && error && (
          <div className="mt-8 rounded-2xl border border-rose-800/60 bg-rose-950/60 p-6 text-sm text-rose-100">
            {error}
          </div>
        )}

        {!loading && !error && tenant && (
          <>
            {/* Summary cards */}
            <section className="mb-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-4 shadow-sm shadow-slate-900/40">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Monthly rent
                </p>
                <p className="mt-3 text-2xl font-semibold text-slate-50">
                  {formatCurrency(
                    tenant.monthly_rent ?? property?.monthly_rent ?? null
                  )}
                </p>
                {property?.name && (
                  <p className="mt-2 text-xs text-slate-500">
                    Property:{' '}
                    <span className="text-slate-200">
                      {property.name}
                      {property.unit_label ? ` · ${property.unit_label}` : ''}
                    </span>
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-4 shadow-sm shadow-slate-900/40">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Status
                </p>
                <div className="mt-3 inline-flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeColor}`}
                  >
                    {tenant.status || 'Unknown'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Keep your payments up to date to maintain a good standing with your
                  landlord.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-emerald-900/40 to-slate-950/80 p-4 shadow-sm shadow-emerald-900/40">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-300">
                  Next rent due
                </p>
                <p className="mt-3 text-xl font-semibold text-emerald-100">
                  {nextDue}
                </p>
                <p className="mt-2 text-xs text-emerald-200/80">
                  In a future update, you&apos;ll be able to pay directly from this
                  screen.
                </p>
              </div>
            </section>

            {/* Two-column layout */}
            <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
              {/* Lease details */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <h2 className="text-sm font-semibold text-slate-100">
                  Lease details
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Review your lease dates and contact info on file.
                </p>

                <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      Lease start
                    </dt>
                    <dd className="mt-1 text-slate-100">
                      {formatDate(tenant.lease_start)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      Lease end
                    </dt>
                    <dd className="mt-1 text-slate-100">
                      {formatDate(tenant.lease_end)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      Email on file
                    </dt>
                    <dd className="mt-1 text-slate-100 break-all">
                      {tenant.email}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      Phone
                    </dt>
                    <dd className="mt-1 text-slate-100">
                      {tenant.phone || 'Not provided'}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 rounded-xl border border-slate-700/60 bg-slate-900/60 p-3 text-xs text-slate-400">
                  If anything here looks incorrect, please contact your landlord directly
                  so they can update your information.
                </div>
              </div>

              {/* Payment history placeholder */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <h2 className="text-sm font-semibold text-slate-100">
                  Payment history
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  A record of recent payments will appear here once this feature is live.
                </p>

                <div className="mt-4 rounded-xl border border-dashed border-slate-700/80 bg-slate-900/60 p-4 text-xs text-slate-500">
                  ✅ Your account is connected.  
                  <span className="block">
                    In a future update, you&apos;ll see each rent payment, amount, and
                    date here — plus downloadable receipts.
                  </span>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
