'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabaseClient';

// ---------- Types ----------

type LandlordRow = {
  id: number;
  email: string;
  name: string | null;
  subscription_status: string | null;
  subscription_current_period_end: string | null;
};

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

type MaintenanceRow = {
  id: number;
  status: string | null;
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

  const local = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds()
  );

  return local.toLocaleDateString('en-US', {
    month: 'long',
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
  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ---------- Load landlord + data ----------

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1) Get auth user
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;

        const email = authData.user?.email;
        if (!email) {
          throw new Error('Unable to load landlord account. Please log in again.');
        }

        // 2) Load landlord row
        const { data: landlordRow, error: landlordError } = await supabase
          .from('landlords')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        if (landlordError) throw landlordError;
        if (!landlordRow) {
          throw new Error(
            'Landlord record not found for this account. Please contact support if this seems wrong.'
          );
        }

        const landlordTyped = landlordRow as LandlordRow;
        setLandlord(landlordTyped);

        // Decide if this landlord is considered "subscribed"
        const statusLower = (landlordTyped.subscription_status || '').toLowerCase();
        const isSubscribed =
          statusLower === 'active' ||
          statusLower === 'trialing' ||
          statusLower === 'active_cancel_at_period_end';

        // If subscription is NOT active / trialing / scheduled to cancel, we stop here.
        if (!isSubscribed) {
          setLoading(false);
          return;
        }

        // 3) Load dashboard data for subscribed landlord
        const [propRes, tenantRes, paymentRes, maintRes] = await Promise.all([
          supabase
            .from('properties')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('tenants')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('payments')
            .select('*')
            .order('paid_on', { ascending: false })
            .limit(10),
          supabase
            .from('maintenance_requests')
            .select('id, status')
            .order('created_at', { ascending: false }),
        ]);

        if (propRes.error) throw propRes.error;
        if (tenantRes.error) throw tenantRes.error;
        if (paymentRes.error) throw paymentRes.error;
        if (maintRes.error) throw maintRes.error;

        setProperties((propRes.data || []) as PropertyRow[]);
        setTenants((tenantRes.data || []) as TenantRow[]);
        setPayments((paymentRes.data || []) as PaymentRow[]);
        setMaintenanceRequests((maintRes.data || []) as MaintenanceRow[]);
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

  const newMaintenanceCount = maintenanceRequests.filter(
    (m) => m.status?.toLowerCase() === 'new'
  ).length;

  // ---------- Actions ----------

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/landlord/login');
  };

  const goToSubscription = () => {
    router.push('/landlord/settings');
  };

  // ---------- UI ----------

  if (loading && !landlord) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 p-6 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading landlord dashboard…</p>
      </div>
    );
  }

  if (!landlord) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 p-6 flex items-center justify-center">
        <div className="max-w-md rounded-2xl bg-slate-900/80 border border-red-500/60 p-5 space-y-3">
          <p className="text-sm text-red-200">
            {error ||
              'We could not find a landlord record for this account. Please contact support.'}
          </p>
          <button
            onClick={handleSignOut}
            className="mt-1 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
          >
            Back to landlord login
          </button>
        </div>
      </div>
    );
  }

  // HARD GATE: subscription must be active / trialing / scheduled-to-cancel to see dashboard
  const statusLower = (landlord.subscription_status || '').toLowerCase();
  const isSubscribed =
    statusLower === 'active' ||
    statusLower === 'trialing' ||
    statusLower === 'active_cancel_at_period_end';

  if (!isSubscribed) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl bg-slate-900/80 border border-amber-500/60 p-6 shadow-xl space-y-4 text-center">
          <p className="text-xs text-amber-300 font-semibold uppercase tracking-wide">
            Subscription required
          </p>
          <h1 className="text-lg font-semibold text-slate-50">
            Unlock your RentZentro landlord tools
          </h1>
          <p className="text-sm text-slate-300">
            Your landlord account is created, but your subscription isn&apos;t active yet.
            To access your dashboard, properties, tenants, and online rent collection,
            please activate the{' '}
            <span className="font-semibold text-emerald-300">
              $29.95/mo RentZentro Landlord Plan
            </span>
            .
          </p>

          <div className="space-y-2 text-[11px] text-slate-400 text-left rounded-2xl bg-slate-950/70 border border-slate-800 px-4 py-3">
            <p className="font-semibold text-slate-100 mb-1">
              Your account includes:
            </p>
            <ul className="space-y-1">
              <li>• Online rent payments via Stripe</li>
              <li>• Tenant and property management</li>
              <li>• Maintenance request tracking + email alerts</li>
              <li>• Document sharing with tenants</li>
            </ul>
          </div>

          <button
            onClick={goToSubscription}
            className="w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Go to subscription settings
          </button>

          <button
            onClick={handleSignOut}
            className="w-full rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            Log out
          </button>
        </div>
      </main>
    );
  }

  // If we're here: landlord exists AND subscription is considered active → show full dashboard
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header / breadcrumb */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
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

          <div className="flex flex-wrap gap-2 md:justify-end">
            {/* Settings */}
            <Link
              href="/landlord/settings"
              className="text-xs px-3 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
            >
              Settings
            </Link>

            {/* Documents */}
            <Link
              href="/landlord/documents"
              className="text-xs px-3 py-2 rounded-full border border-emerald-600 bg-slate-900 text-emerald-300 hover:bg-slate-800 hover:text-emerald-200"
            >
              Documents
            </Link>

            {/* Maintenance with badge */}
            <Link
              href="/landlord/maintenance"
              className="relative flex items-center gap-1 text-xs px-3 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            >
              <span>Maintenance</span>
              {newMaintenanceCount > 0 && (
                <span className="ml-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-slate-950">
                  {newMaintenanceCount}
                </span>
              )}
            </Link>

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

            <div className="flex flex-wrap gap-2">
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
              Card payments from tenants are recorded here automatically after
              Stripe confirms the payment.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
