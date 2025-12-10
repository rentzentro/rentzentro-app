// app/tenant/portal/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

// ---------- Types ----------

type TenantRow = {
  id: number;
  owner_id: string | null; // landlord's auth UID
  name: string | null;
  email: string;
  phone: string | null;
  status: string | null;
  property_id: number | null;
  monthly_rent: number | null;
  lease_start: string | null;
  lease_end: string | null;
  user_id?: string | null;
};

type PropertyRow = {
  id: number;
  name: string | null;
  unit_label: string | null;
  monthly_rent: number | null;
  next_due_date: string | null;
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

type DocumentRow = {
  id: number;
  created_at: string;
  title: string;
  file_url: string;
  property_id: number | null;
  tenant_id: number | null;
};

type MaintenanceRow = {
  id: number;
  tenant_id: number;
  property_id: number;
  title: string;
  description: string;
  status: string | null;
  priority: string | null;
  created_at: string;
  resolution_note: string | null;
};

// ---------- Helpers ----------

const parseSupabaseDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  // Pure date (YYYY-MM-DD) → avoid timezone shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const formatCurrency = (v: number | null | undefined) =>
  v == null || isNaN(v)
    ? '-'
    : v.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
      });

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '-';
  const d = parseSupabaseDate(iso);
  if (!d) return '-';
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatStatusLabel = (status: string | null) => {
  if (!status) return 'Unknown';
  const s = status.toLowerCase();
  if (s === 'new') return 'New';
  if (s === 'in progress') return 'In Progress';
  if (s === 'resolved' || s === 'closed') return 'Resolved';
  return status;
};

const statusBadgeClasses = (status: string | null) => {
  const s = (status || '').toLowerCase();
  if (s === 'new') {
    return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40';
  }
  if (s === 'in progress') {
    return 'bg-amber-500/15 text-amber-300 border border-amber-500/40';
  }
  if (s === 'resolved' || s === 'closed') {
    return 'bg-sky-500/15 text-sky-300 border border-sky-500/40';
  }
  return 'bg-slate-700 text-slate-200 border border-slate-500/60';
};

// Months difference helper: whole months between two dates (ignore days)
const monthsBetween = (from: Date, to: Date) => {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  );
};

// ---------- Component ----------

export default function TenantPortalPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [property, setProperty] = useState<PropertyRow | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRow[]>([]);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  // Overdue math (based on lease_start + total payments)
  const [totalDue, setTotalDue] = useState<number | null>(null);
  const [totalPaidToward, setTotalPaidToward] = useState<number | null>(null);
  const [totalOutstanding, setTotalOutstanding] = useState<number | null>(null);

  // Auto-pay UI toggle (front-end only right now)
  const [autoPayEnabled, setAutoPayEnabled] = useState(false);

  // ---------- Load tenant + related data ----------

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError) throw authError;

        const user = authData.user;
        const email = user?.email;
        const authUserId = user?.id;

        if (!email || !authUserId) {
          throw new Error('Unable to load tenant: missing account data.');
        }

        // Tenant: prefer user_id match, fall back to email
        const { data: tenantRows, error: tenantError } = await supabase
          .from('tenants')
          .select(
            'id, owner_id, name, email, phone, status, property_id, monthly_rent, lease_start, lease_end, user_id'
          )
          .or(`user_id.eq.${authUserId},email.eq.${email}`)
          .order('created_at', { ascending: true });

        if (tenantError) throw tenantError;

        let t: TenantRow | null =
          tenantRows && tenantRows.length > 0
            ? (tenantRows.find((row: any) => row.user_id === authUserId) ??
              tenantRows[0])
            : null;

        if (!t) {
          setTenant(null);
          setProperty(null);
          setPayments([]);
          setDocuments([]);
          setMaintenance([]);
          setTotalDue(null);
          setTotalPaidToward(null);
          setTotalOutstanding(null);
          setError(
            'We couldn’t find a tenant profile for this email yet. ' +
              'This usually means your landlord hasn’t added you to their tenant list, or used a different email. ' +
              'Please contact your landlord to confirm they added you with this exact email address.'
          );
          return;
        }

        // --- Auto-link tenant.user_id on first login ---
        if (!t.user_id) {
          const { data: updated, error: updateError } = await supabase
            .from('tenants')
            .update({ user_id: authUserId })
            .eq('id', t.id)
            .select(
              'id, owner_id, name, email, phone, status, property_id, monthly_rent, lease_start, lease_end, user_id'
            )
            .maybeSingle();

          if (updateError) {
            console.error('Failed to link tenant.user_id:', updateError);
          } else if (updated) {
            t = updated as TenantRow;
          }
        }

        setTenant(t);

        // -------- Property: try by property_id first --------
        let prop: PropertyRow | null = null;

        if (t.property_id) {
          const { data: propRow, error: propError } = await supabase
            .from('properties')
            .select('id, name, unit_label, monthly_rent, next_due_date')
            .eq('id', t.property_id)
            .maybeSingle();

          if (propError) {
            console.error(
              'Tenant portal property lookup (by id) error:',
              propError
            );
          } else if (propRow) {
            prop = propRow as PropertyRow;
          }
        }

        // -------- Fallback: first property for same landlord owner_id --------
        if (!prop && t.owner_id) {
          const { data: propRows2, error: propError2 } = await supabase
            .from('properties')
            .select(
              'id, name, unit_label, monthly_rent, next_due_date, owner_id'
            )
            .eq('owner_id', t.owner_id)
            .order('created_at', { ascending: true })
            .limit(1);

          if (propError2) {
            console.error(
              'Tenant portal property lookup (by owner_id) error:',
              propError2
            );
          } else if (propRows2 && propRows2.length > 0) {
            prop = propRows2[0] as PropertyRow;
          }
        }

        setProperty(prop);

        // Effective rent (property preferred, fall back to tenant)
        const effectiveRent =
          prop?.monthly_rent ?? t.monthly_rent ?? null;

        // Payments
        const { data: payRows, error: payError } = await supabase
          .from('payments')
          .select('id, tenant_id, property_id, amount, paid_on, method, note')
          .eq('tenant_id', t.id)
          .order('paid_on', { ascending: false })
          .limit(50);

        if (payError) {
          console.error('Tenant portal payments error:', payError);
        }

        const payData = (payRows || []) as PaymentRow[];
        setPayments(payData);

        // ---------- Compute totals based on lease_start ----------
        let newTotalDue: number | null = null;
        let newTotalPaidToward = 0;
        let newOutstanding: number | null = null;

        const today = new Date();
        const todayMidnight = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        );

        const leaseStartDate = parseSupabaseDate(t.lease_start);

        if (effectiveRent != null && leaseStartDate && leaseStartDate <= todayMidnight) {
          // Number of months from lease_start through this month (inclusive)
          const mDiff = monthsBetween(leaseStartDate, todayMidnight);
          const periodsOwed = Math.max(1, mDiff + 1); // at least 1 period if we've passed lease_start

          newTotalDue = periodsOwed * effectiveRent;

          // Sum ALL payments since lease_start toward those periods
          for (const p of payData) {
            if (!p.amount || !p.paid_on) continue;
            const pd = parseSupabaseDate(p.paid_on);
            if (!pd) continue;
            if (pd >= leaseStartDate) {
              newTotalPaidToward += p.amount;
            }
          }

          newOutstanding = Math.max(0, newTotalDue - newTotalPaidToward);
        } else if (effectiveRent != null && leaseStartDate && leaseStartDate > todayMidnight) {
          // Lease hasn't started yet → nothing due yet
          newTotalDue = 0;
          newTotalPaidToward = 0;
          newOutstanding = 0;
        } else {
          // No lease_start set → fall back to a single-period view
          newTotalDue = effectiveRent;
          newTotalPaidToward = 0;
          newOutstanding = Math.max(0, effectiveRent ?? 0);
        }

        setTotalDue(newTotalDue);
        setTotalPaidToward(newTotalPaidToward);
        setTotalOutstanding(newOutstanding);

        // Documents (by property OR tenant)
        let docQuery = supabase
          .from('documents')
          .select('id, created_at, title, file_url, property_id, tenant_id')
          .order('created_at', { ascending: false });

        if (prop?.id) {
          docQuery = docQuery.or(
            `property_id.eq.${prop.id},tenant_id.eq.${t.id}`
          );
        } else {
          docQuery = docQuery.eq('tenant_id', t.id);
        }

        const { data: docRows, error: docError } = await docQuery;
        if (docError) {
          console.error('Tenant portal documents error:', docError);
        }
        setDocuments((docRows || []) as DocumentRow[]);

        // Recent maintenance
        const { data: maintRows, error: maintError } = await supabase
          .from('maintenance_requests')
          .select(
            'id, tenant_id, property_id, title, description, status, priority, created_at, resolution_note'
          )
          .eq('tenant_id', t.id)
          .order('created_at', { ascending: false })
          .limit(4);

        if (maintError) {
          console.error('Tenant portal maintenance error:', maintError);
        }
        setMaintenance((maintRows || []) as MaintenanceRow[]);

        // ---------- Unread messages badge ----------
        if (t.user_id) {
          const { data: unreadRows, error: unreadError } = await supabase
            .from('messages')
            .select('id')
            .eq('tenant_user_id', t.user_id)
            .in('sender_type', ['landlord', 'team'])
            .is('read_at', null);

          if (unreadError) {
            console.error('Tenant portal unread messages error:', unreadError);
          } else {
            setNewMessageCount((unreadRows || []).length);
          }
        } else {
          setNewMessageCount(0);
        }
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ||
            'Failed to load tenant information. Please try again or contact your landlord.'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // ---------- Actions ----------

  const handleBack = () => {
    router.back();
  };

  const handleLogOut = async () => {
    await supabase.auth.signOut();
    router.push('/tenant/login');
  };

  const handleToggleAutoPay = () => {
    setAutoPayEnabled((prev) => !prev);
    setSuccess(
      'Automatic payments are a planned feature and are not live yet. For now, please continue paying manually each month.'
    );
  };

  const handlePayWithCard = async () => {
    if (!tenant) return;

    const baseRent = property?.monthly_rent ?? tenant.monthly_rent ?? 0;

    const today = new Date();
    const todayMidnight = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    // Earliest due date we know about (for "no early payments")
    const earliestDueDate =
      parseSupabaseDate(tenant.lease_start) ||
      parseSupabaseDate(property?.next_due_date || null);

    const isBeforeFirstDue =
      !!earliestDueDate && todayMidnight < earliestDueDate;

    if (isBeforeFirstDue) {
      setError(
        'Online rent payments are only available once your first rent due date arrives. Please try again on or after the due date.'
      );
      setSuccess(null);
      return;
    }

    // Charge outstanding if any, otherwise base rent
    const amount =
      totalOutstanding != null && totalOutstanding > 0
        ? totalOutstanding
        : baseRent;

    if (!amount || amount <= 0) {
      setError(
        'Your rent appears to be fully paid or not set for this period. Please contact your landlord if this looks wrong.'
      );
      setSuccess(null);
      return;
    }

    setPaying(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          description: `Rent payment for ${
            property?.name || 'your unit'
          }${property?.unit_label ? ` · ${property.unit_label}` : ''}`,
          tenantId: tenant.id,
          propertyId: property?.id ?? null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.error ||
            `Failed to create payment session (status ${res.status}).`
        );
      }

      const data = await res.json();
      if (!data?.url) {
        throw new Error('Stripe session created without a redirect URL.');
      }

      window.location.href = data.url;
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Something went wrong while starting your card payment. Please try again.'
      );
    } finally {
      setPaying(false);
    }
  };

  // ---------- Render ----------

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading your tenant portal…</p>
      </main>
    );
  }

  if (!tenant) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-slate-900/80 border border-slate-700 p-6 shadow-xl space-y-4">
          <p className="text-sm text-red-400">
            {error ||
              'We could not find a tenant record for this account. Please reach out to your landlord.'}
          </p>
          <button
            onClick={handleLogOut}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
          >
            Back to login
          </button>
        </div>
      </main>
    );
  }

  const currentRent =
    property?.monthly_rent ?? tenant.monthly_rent ?? null;

  // For status + early-pay text (we still show next_due_date if you’ve set it)
  const dueDateObj = parseSupabaseDate(property?.next_due_date || null);
  const today = new Date();
  const todayMidnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const isRentOverdue =
    !!dueDateObj && dueDateObj.getTime() < todayMidnight.getTime();

  const earliestDueDate =
    parseSupabaseDate(tenant.lease_start) || dueDateObj;

  const isBeforeDue =
    !!earliestDueDate && todayMidnight < earliestDueDate;

  const amountToPayNow =
    !isBeforeDue && totalOutstanding != null && totalOutstanding > 0
      ? totalOutstanding
      : null;

  const accountStatusLabel = isRentOverdue
    ? 'Rent overdue'
    : tenant.status?.toLowerCase() === 'current'
    ? 'Current tenant in good standing'
    : tenant.status || 'Status not set';

  const accountStatusClasses = isRentOverdue
    ? 'mt-3 inline-flex items-center gap-2 rounded-full border border-red-500/50 bg-red-950/70 px-3 py-1 text-[11px] text-red-100'
    : 'mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-950/40 px-3 py-1 text-[11px] text-emerald-100';

  const accountStatusDotClasses = isRentOverdue
    ? 'inline-block h-1.5 w-1.5 rounded-full bg-red-400'
    : 'inline-block h-1.5 w-1.5 rounded-full bg-emerald-400';

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-4">
        {(success || error) && (
          <div
            className={`rounded-xl border px-4 py-2 text-sm ${
              success
                ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/60 bg-red-500/10 text-red-200'
            }`}
          >
            {success || error}
          </div>
        )}

        {/* Header row */}
        <header className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <button
              type="button"
              onClick={handleBack}
              className="text-[11px] text-slate-500 hover:text-emerald-300"
            >
              ← Back
            </button>
            <h1 className="text-lg font-semibold text-slate-50">
              Tenant portal
            </h1>
            <p className="text-[11px] text-slate-400">
              View your rent details, lease info, documents, and payment
              history.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-right">
            <div className="text-xs">
              <p className="font-medium text-slate-100">
                {tenant.name || 'Tenant'}
              </p>
              <p className="text-slate-400 text-[11px]">{tenant.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/tenant/messages"
                className="relative inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 border border-slate-600 hover:bg-slate-800"
              >
                <span>Messages</span>
                {newMessageCount > 0 && (
                  <span className="ml-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-slate-950">
                    {newMessageCount}
                  </span>
                )}
              </Link>
              <button
                onClick={handleLogOut}
                className="rounded-md bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
              >
                Log out
              </button>
            </div>
          </div>
        </header>

        {/* Main grid */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)]">
          {/* LEFT COLUMN */}
          <div className="space-y-4">
            {/* Current rent / actions */}
            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Current rent
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="text-2xl font-semibold text-slate-50">
                  {formatCurrency(currentRent)}
                </p>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Next due date:{' '}
                <span className="text-slate-200">
                  {formatDate(property?.next_due_date)}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Property:{' '}
                <span className="text-slate-200">
                  {property?.name || 'Not set'}
                  {property?.unit_label ? ` · ${property.unit_label}` : ''}
                </span>
              </p>

              {/* Totals based on lease_start */}
              {currentRent != null && (
                <>
                  <p className="mt-2 text-xs text-slate-400">
                    Total paid toward overdue rent:{' '}
                    <span className="text-slate-200">
                      {formatCurrency(totalPaidToward ?? 0)}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Total outstanding rent:{' '}
                    <span className="text-slate-200">
                      {formatCurrency(totalOutstanding ?? 0)}
                    </span>
                  </p>
                </>
              )}

              {/* Auto-pay toggle (UI only, not wired yet) */}
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-2.5 text-[11px]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-100">
                      Automatic payments
                    </p>
                    <p className="text-slate-400">
                      Turn this on to have rent charged automatically each
                      period. (Coming soon)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleAutoPay}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                      autoPayEnabled
                        ? 'bg-emerald-500 border-emerald-400'
                        : 'bg-slate-800 border-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        autoPayEnabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-amber-300">
                  Automatic charges are not active yet in this version of
                  RentZentro. You&apos;ll still need to pay manually until your
                  landlord confirms auto-pay is available.
                </p>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handlePayWithCard}
                  disabled={
                    paying ||
                    isBeforeDue ||
                    !amountToPayNow ||
                    amountToPayNow <= 0
                  }
                  className="w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {paying
                    ? 'Starting payment…'
                    : isBeforeDue
                    ? 'Online payment not available until due date'
                    : !amountToPayNow || amountToPayNow <= 0
                    ? 'You’re all caught up'
                    : `Pay ${formatCurrency(amountToPayNow)} now`}
                </button>
              </div>

              <p className="mt-3 text-[11px] text-slate-500">
                Card / ACH payments are processed securely by Stripe. You&apos;ll
                get a confirmation once your payment is completed.
              </p>
            </section>

            {/* Payment history */}
            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">
                    Payment history
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-50">
                    Your recent payments
                  </p>
                </div>
              </div>

              {payments.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">
                  No rent payments recorded yet.
                </p>
              ) : (
                <div className="mt-3 space-y-2 text-xs">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-50">
                          {formatCurrency(p.amount)}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {formatDateTime(p.paid_on)}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-slate-300">
                          {p.method || 'Payment'}
                        </p>
                        {p.note && (
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            {p.note}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4">
            {/* Account Status / Lease info */}
            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Account status
              </p>
              <h2 className="mt-1 text-sm font-semibold text-slate-50">
                {tenant.name || 'Tenant account'}
              </h2>
              <p className="mt-1 text-xs text-slate-400">{tenant.email}</p>

              <div className={accountStatusClasses}>
                <span className={accountStatusDotClasses} />
                {accountStatusLabel}
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
                <div>
                  <dt className="text-slate-500">Lease start</dt>
                  <dd className="text-slate-100">
                    {formatDate(tenant.lease_start)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Lease end</dt>
                  <dd className="text-slate-100">
                    {formatDate(tenant.lease_end)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Tenant phone</dt>
                  <dd className="text-slate-100">
                    {tenant.phone || 'Not provided'}
                  </dd>
                </div>
              </dl>

              <p className="mt-3 text-[11px] text-slate-500">
                For changes to your lease, rent amount, or due date, please
                reach out to your landlord or property manager.
              </p>
            </section>

            {/* Lease & documents */}
            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Lease & documents
              </p>
              <p className="mt-1 text-sm font-medium text-slate-50">
                Files shared for your unit
              </p>

              {documents.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">
                  Your landlord hasn&apos;t shared any documents for this unit
                  yet. If you&apos;re expecting a copy of your lease or other
                  paperwork, please contact them directly.
                </p>
              ) : (
                <div className="mt-3 space-y-2 text-xs">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-slate-50 text-[13px]">
                          {doc.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          Added {formatDateTime(doc.created_at)}
                        </p>
                      </div>
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-3 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800"
                      >
                        Open
                      </a>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-3 text-[11px] text-slate-500">
                Documents here are read-only. For questions about any lease
                terms, reach out to your landlord.
              </p>
            </section>

            {/* Maintenance overview */}
            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Maintenance
              </p>
              <p className="mt-1 text-sm font-medium text-slate-50">
                Requests for your unit
              </p>

              <p className="mt-2 text-[11px] text-slate-400">
                Use a maintenance request to report issues with your unit—for
                example plumbing, heating, appliances, or general repairs. Your
                requests are sent to your landlord and tracked for your records.
              </p>
              <p className="mt-1 text-[10px] text-amber-300 flex items-start gap-1">
                <span className="text-amber-300 text-xs mt-[1px]">⚠️</span>
                For true emergencies (fire, active flooding, gas smells, or
                anything life-threatening), call your local emergency services
                first, then contact your landlord or property manager directly.
              </p>

              {maintenance.length === 0 ? (
                <p className="mt-3 text-[11px] text-slate-500">
                  You haven&apos;t submitted any maintenance requests yet.
                </p>
              ) : (
                <div className="mt-3 space-y-2 text-[11px]">
                  {maintenance.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-3 min-w-0">
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-slate-50 text-[13px]">
                            {m.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {formatDateTime(m.created_at)}
                          </p>
                          {m.priority && (
                            <p className="mt-0.5 text-[10px] text-slate-500">
                              Priority: {m.priority}
                            </p>
                          )}

                          {m.resolution_note && (
                            <p className="mt-1 text-[10px] text-slate-300 line-clamp-2 break-words">
                              <span className="font-semibold text-slate-200">
                                Landlord note:{' '}
                              </span>
                              {m.resolution_note}
                            </p>
                          )}
                        </div>
                        <span
                          className={
                            'shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ' +
                            statusBadgeClasses(m.status)
                          }
                        >
                          {formatStatusLabel(m.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/tenant/maintenance"
                  className="flex-1 inline-flex items-center justify-center rounded-full border border-emerald-500/60 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20"
                >
                  Submit a maintenance request
                </Link>
                <Link
                  href="/tenant/maintenance"
                  className="flex-1 inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                >
                  View all requests
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
