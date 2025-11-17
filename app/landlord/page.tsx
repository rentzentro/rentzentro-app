'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabaseClient';

// ---------- Types ----------

type PropertyRow = {
  id: number;
  name: string | null;
  unit_label: string | null;
  monthly_rent: number | null;
  status: string | null;
  next_due_date: string | null;
};

type TenantRow = {
  id: number;
  name: string | null;
  email: string;
  phone: string | null;
  property_id: number | null;
  monthly_rent: number | null;
  status: string | null;
};

type PaymentRow = {
  id: number;
  tenant_id: number | null;
  property_id: number | null;
  amount: number | null;
  paid_on: string | null;
  method: string | null;
  note: string | null;
};

// ---------- Helpers ----------

const formatCurrency = (v: number | null | undefined) =>
  v == null || isNaN(v)
    ? '-'
    : v.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
      });

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const parseDueDate = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

// ---------- Component ----------

export default function LandlordDashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ---------- Load data ----------

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [propRes, tenantRes, paymentRes] = await Promise.all([
          supabase.from('properties').select('*').order('created_at', {
            ascending: false,
          }),
          supabase.from('tenants').select('*').order('created_at', {
            ascending: false,
          }),
          supabase
            .from('payments')
            .select('*')
            .order('paid_on', { ascending: false })
            .limit(10),
        ]);

        if (propRes.error) throw propRes.error;
        if (tenantRes.error) throw tenantRes.error;
        if (paymentRes.error) throw paymentRes.error;

        setProperties((propRes.data || []) as PropertyRow[]);
        setTenants((tenantRes.data || []) as TenantRow[]);
        setPayments((paymentRes.data || []) as PaymentRow[]);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to load landlord dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // ---------- Metrics ----------

  const totalProperties = properties.length;

  const activeTenants = tenants.filter(
    (t) => t.status?.toLowerCase() === 'current'
  ).length;

  const monthlyRentRoll = properties
    .filter((p) => p.status?.toLowerCase() === 'current')
    .reduce((sum, p) => sum + (p.monthly_rent || 0), 0);

  const today = new Date();
  const todayDateOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const sevenDaysFromNow = new Date(
    todayDateOnly.getFullYear(),
    todayDateOnly.getMonth(),
    todayDateOnly.getDate() + 7
  );

  const overdue = properties.filter((p) => {
    const due = parseDueDate(p.next_due_date);
    if (!due) return false;
    return due < todayDateOnly;
  });

  const upcoming7 = properties.filter((p) => {
    const due = parseDueDate(p.next_due_date);
    if (!due) return false;
    return due >= todayDateOnly && due <= sevenDaysFromNow;
  });

  const notDueYet = properties.filter((p) => {
    const due = parseDueDate(p.next_due_date);
    if (!due) return true;
    return due > sevenDaysFromNow;
  });

  const propertyById = new Map<number, PropertyRow>();
  properties.forEach((p) => propertyById.set(p.id, p));

  const tenantById = new Map<number, TenantRow>();
  tenants.forEach((t) => tenantById.set(t.id, t));

  // ---------- Actions ----------

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/landlord/login');
  };

  // ---------- UI ----------

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 p-6">
        <p>Loading landlord dashboard…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header / breadcrumb */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="text-xs text-slate-500 flex gap-2">
              <Link href="/landlord" className="hover:text-emerald-400">
                Landlord
              </Link>
              <span>/</span>
              <span className="text-slate-300">Dashboard</span>
            </div>
            <h1 className="text-xl font-semibold mt-1 text-slate-50">
              Landlord dashboard
            </h1>
            <p className="text-[13px] text-slate-400">
              Overview of your units, rent status, and recent payments.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Settings (coming soon) */}
            <button
              type="button"
              className="text-xs px-3 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
            >
              Settings (coming soon)
            </button>

            {/* Sign out */}
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs px-3 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        </div>

        {/* 🔔 Pricing banner (2.5% fee) */}
        <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-100">
          <p className="font-medium">
            Current RentZentro pricing:{' '}
            <span className="font-semibold">
              2.5% platform fee per successful card payment.
            </span>
          </p>
          <p className="mt-1 text-[11px] text-emerald-200/80">
            The platform fee is charged to the landlord and is in addition to
            Stripe&apos;s processing fees. See our{' '}
            <Link href="/terms" className="underline">
              Terms of Service
            </Link>{' '}
            for details.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 text-sm p-3 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-100">
            {error}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800 shadow-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Properties
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">
              {totalProperties}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Total units you&apos;re tracking in RentZentro.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800 shadow-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Active tenants
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">
              {activeTenants}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Tenants with current leases.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800 shadow-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Monthly rent roll
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-400">
              {formatCurrency(monthlyRentRoll)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Rent for all current units this month.
            </p>
          </div>
        </div>

        {/* Rent status: overdue / upcoming / not due yet */}
        <section className="mb-6 p-4 rounded-2xl bg-slate-950/70 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Rent status
              </p>
              <p className="mt-1 text-sm font-medium text-slate-50">
                Overdue, upcoming, and future rent
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href="/landlord/properties"
                className="text-[11px] px-3 py-1 rounded-full border border-slate-700 bg-slate-900 hover:bg-slate-800"
              >
                Manage properties
              </Link>
              <Link
                href="/landlord/tenants"
                className="text-[11px] px-3 py-1 rounded-full border border-slate-700 bg-slate-900 hover:bg-slate-800"
              >
                Manage tenants
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 text-xs">
            {/* Overdue */}
            <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-rose-200">Overdue</p>
                <span className="text-[11px] text-rose-200/80">
                  {overdue.length}
                </span>
              </div>
              {overdue.length === 0 ? (
                <p className="text-[11px] text-rose-100/70">
                  No units overdue right now.
                </p>
              ) : (
                <div className="space-y-2">
                  {overdue.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl bg-rose-950/40 border border-rose-500/40 px-2 py-1.5"
                    >
                      <p className="text-[11px] text-rose-50 font-medium">
                        {p.name || 'Property'}{' '}
                        {p.unit_label ? `· ${p.unit_label}` : ''}
                      </p>
                      <p className="text-[11px] text-rose-100/80">
                        Due {formatDate(p.next_due_date)} •{' '}
                        {formatCurrency(p.monthly_rent)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming 7 days */}
            <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-amber-200">
                  Upcoming 7 days
                </p>
                <span className="text-[11px] text-amber-200/80">
                  {upcoming7.length}
                </span>
              </div>
              {upcoming7.length === 0 ? (
                <p className="text-[11px] text-amber-100/80">
                  No rent coming due in the next week.
                </p>
              ) : (
                <div className="space-y-2">
                  {upcoming7.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl bg-amber-950/40 border border-amber-500/40 px-2 py-1.5"
                    >
                      <p className="text-[11px] text-amber-50 font-medium">
                        {p.name || 'Property'}{' '}
                        {p.unit_label ? `· ${p.unit_label}` : ''}
                      </p>
                      <p className="text-[11px] text-amber-100/90">
                        Due {formatDate(p.next_due_date)} •{' '}
                        {formatCurrency(p.monthly_rent)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Not due yet */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-emerald-200">
                  Not due yet
                </p>
                <span className="text-[11px] text-emerald-200/80">
                  {notDueYet.length}
                </span>
              </div>
              {notDueYet.length === 0 ? (
                <p className="text-[11px] text-emerald-100/80">
                  No units in &quot;not due yet&quot; status.
                </p>
              ) : (
                <div className="space-y-2">
                  {notDueYet.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl bg-emerald-950/40 border border-emerald-500/40 px-2 py-1.5"
                    >
                      <p className="text-[11px] text-emerald-50 font-medium">
                        {p.name || 'Property'}{' '}
                        {p.unit_label ? `· ${p.unit_label}` : ''}
                      </p>
                      <p className="text-[11px] text-emerald-100/90">
                        {p.next_due_date
                          ? `Due ${formatDate(p.next_due_date)}`
                          : 'No due date set'}
                        {' • '}
                        {formatCurrency(p.monthly_rent)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Properties + Recent payments */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)]">
          {/* Left: Properties */}
          <section className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  Properties
                </p>
                <p className="mt-1 text-sm font-medium text-slate-50">
                  Units & rent
                </p>
              </div>
              <Link
                href="/landlord/properties"
                className="text-[11px] px-3 py-1 rounded-full border border-slate-700 bg-slate-900 hover:bg-slate-800"
              >
                View all
              </Link>
            </div>

            {properties.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500">
                No properties yet. Add your first unit from the properties
                screen.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {properties.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/70 text-xs"
                  >
                    <div>
                      <p className="font-medium text-slate-100">
                        {p.name || 'Untitled property'}
                        {p.unit_label ? ` · ${p.unit_label}` : ''}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Rent:{' '}
                        <span className="text-slate-200">
                          {formatCurrency(p.monthly_rent)}
                        </span>
                        {' • '}
                        Status:{' '}
                        <span className="text-slate-200">
                          {p.status || 'Unknown'}
                        </span>
                      </p>
                      {p.next_due_date && (
                        <p className="text-[11px] text-slate-500">
                          Next due: {formatDate(p.next_due_date)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Right: Recent payments */}
          <section className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  Recent payments
                </p>
                <p className="mt-1 text-sm font-medium text-slate-50">
                  Latest rent activity
                </p>
              </div>
              <Link
                href="/landlord/payments"
                className="text-[11px] px-3 py-1 rounded-full border border-slate-700 bg-slate-900 hover:bg-slate-800"
              >
                View all
              </Link>
            </div>

            {payments.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500">
                No payments recorded yet.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {payments.map((p) => {
                  const t = p.tenant_id ? tenantById.get(p.tenant_id) : null;
                  const prop = p.property_id
                    ? propertyById.get(p.property_id)
                    : null;

                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/70 text-xs"
                    >
                      <div>
                        <p className="font-medium text-slate-100">
                          {formatCurrency(p.amount)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {formatDate(p.paid_on)}
                          {t && (
                            <>
                              {' • '}
                              <span>{t.name || t.email}</span>
                            </>
                          )}
                          {prop && (
                            <>
                              {' • '}
                              <span>
                                {prop.name}
                                {prop.unit_label
                                  ? ` · ${prop.unit_label}`
                                  : ''}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-slate-400">
                          {p.method || 'Method not specified'}
                        </p>
                        {p.note && (
                          <p className="mt-0.5 max-w-[180px] truncate text-[11px] text-slate-500">
                            {p.note}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="mt-3 text-[11px] text-slate-500">
              Once Stripe webhooks are connected, card payments from tenants
              will appear here automatically.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
