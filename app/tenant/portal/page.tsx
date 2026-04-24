// app/tenant/portal/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';
import ExploreNearbySection from './ExploreNearbySection';
import {
  getMaintenanceStatusMeta,
  normalizeMaintenanceStatus,
} from '../../lib/maintenanceStatus';

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
  allow_early_payment?: boolean | null;
  auto_pay_enabled?: boolean | null;
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

type RentStatus = {
  totalDue: number;
  totalPaid: number;
  outstanding: number;
  monthsDue: number;
  nextDueDate: string | null; // ISO or YYYY-MM-DD
  isCaughtUp: boolean;
};

// ---------- Helpers ----------

const parseSupabaseDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const dateToYMD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  return getMaintenanceStatusMeta(status).label;
};

const statusBadgeClasses = (status: string | null) => {
  const s = normalizeMaintenanceStatus(status);
  if (s === 'new') {
    return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40';
  }
  if (s === 'in_progress' || s === 'scheduled') {
    return 'bg-amber-500/15 text-amber-300 border border-amber-500/40';
  }
  if (s === 'waiting_parts') {
    return 'bg-orange-500/15 text-orange-300 border border-orange-500/40';
  }
  if (s === 'completed') {
    return 'bg-sky-500/15 text-sky-300 border border-sky-500/40';
  }
  return 'bg-slate-700 text-slate-200 border border-slate-500/60';
};

const monthsBetween = (from: Date, to: Date) => {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  );
};

const calculateRentStatus = (
  monthlyRent: number | null,
  firstDueDateISO: string | null,
  payments: PaymentRow[]
): RentStatus => {
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  if (!monthlyRent || !firstDueDateISO) {
    return {
      totalDue: 0,
      totalPaid,
      outstanding: 0,
      monthsDue: 0,
      nextDueDate: firstDueDateISO,
      isCaughtUp: true,
    };
  }

  const firstDue = parseSupabaseDate(firstDueDateISO);
  if (!firstDue) {
    return {
      totalDue: 0,
      totalPaid,
      outstanding: 0,
      monthsDue: 0,
      nextDueDate: firstDueDateISO,
      isCaughtUp: true,
    };
  }

  const today = new Date();
  const todayMidnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const firstDueMidnight = new Date(
    firstDue.getFullYear(),
    firstDue.getMonth(),
    firstDue.getDate()
  );

  if (firstDueMidnight > todayMidnight) {
    return {
      totalDue: 0,
      totalPaid,
      outstanding: 0,
      monthsDue: 0,
      nextDueDate: dateToYMD(firstDueMidnight),
      isCaughtUp: true,
    };
  }

  const mDiff = monthsBetween(firstDueMidnight, todayMidnight);
  const monthsDue = Math.max(1, mDiff + 1);

  const totalDue = monthsDue * monthlyRent;
  const outstanding = Math.max(0, totalDue - totalPaid);
  const isCaughtUp = outstanding <= 0;

  let remainingPaid = totalPaid;
  let monthCursor = new Date(firstDueMidnight);
  let unpaidMonth: Date | null = null;

  for (let i = 0; i < monthsDue; i++) {
    if (remainingPaid >= monthlyRent) {
      remainingPaid -= monthlyRent;
      monthCursor = new Date(
        monthCursor.getFullYear(),
        monthCursor.getMonth() + 1,
        monthCursor.getDate()
      );
    } else {
      unpaidMonth = new Date(monthCursor);
      break;
    }
  }

  let nextDueDate: string | null;

  if (unpaidMonth) {
    nextDueDate = dateToYMD(unpaidMonth);
  } else {
    const next = new Date(
      firstDueMidnight.getFullYear(),
      firstDueMidnight.getMonth() + monthsDue,
      firstDueMidnight.getDate()
    );
    nextDueDate = dateToYMD(next);
  }

  return {
    totalDue,
    totalPaid,
    outstanding,
    monthsDue,
    nextDueDate,
    isCaughtUp,
  };
};

const resolveFirstDueDateISO = (
  leaseStartISO: string | null,
  nextDueISO: string | null
): string | null => {
  const nextDueDate = parseSupabaseDate(nextDueISO);
  if (nextDueDate) {
    return dateToYMD(nextDueDate);
  }

  const leaseStartDate = parseSupabaseDate(leaseStartISO);
  if (leaseStartDate) {
    return dateToYMD(leaseStartDate);
  }

  return null;
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

  const [rentStatus, setRentStatus] = useState<RentStatus | null>(null);

  const [autoPayEnabled, setAutoPayEnabled] = useState(false);
  const [autoPayLoading, setAutoPayLoading] = useState(false);

  const [landlordBillingBlocked, setLandlordBillingBlocked] = useState(false);
  const [landlordBillingMsg, setLandlordBillingMsg] = useState<string | null>(
    null
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);
      setLandlordBillingBlocked(false);
      setLandlordBillingMsg(null);

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

        const { data: tenantRows, error: tenantError } = await supabase
          .from('tenants')
          .select(
            'id, owner_id, name, email, phone, status, property_id, monthly_rent, lease_start, lease_end, user_id, allow_early_payment, auto_pay_enabled'
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
          setRentStatus(null);
          setAutoPayEnabled(false);
          setError(
            'We couldn’t find a tenant profile for this email yet. This usually means your landlord hasn’t added you to their tenant list, or used a different email. Please contact your landlord to confirm they added you with this exact email address.'
          );
          return;
        }

        if (!t.user_id) {
          const { data: updated, error: updateError } = await supabase
            .from('tenants')
            .update({ user_id: authUserId })
            .eq('id', t.id)
            .select(
              'id, owner_id, name, email, phone, status, property_id, monthly_rent, lease_start, lease_end, user_id, allow_early_payment, auto_pay_enabled'
            )
            .maybeSingle();

          if (updateError) {
            console.error('Failed to link tenant.user_id:', updateError);
          } else if (updated) {
            t = updated as TenantRow;
          }
        }

        setTenant(t);
        setAutoPayEnabled(!!t.auto_pay_enabled);

        if (t.owner_id) {
          try {
            const res = await fetch('/api/tenant-landlord-access', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ownerId: t.owner_id }),
            });

            const data = await res.json().catch(() => ({} as any));

            if (data?.allowed) {
              setLandlordBillingBlocked(false);
              setLandlordBillingMsg(null);
            } else {
              setLandlordBillingBlocked(true);
              setLandlordBillingMsg(
                data?.reason ||
                  'Online payments and maintenance are temporarily unavailable because your landlord’s RentZentro account is not currently active. Please contact your landlord or property manager.'
              );
            }
          } catch (e) {
            console.error('Tenant portal landlord access API error:', e);
            setLandlordBillingBlocked(true);
            setLandlordBillingMsg(
              'Online payments and maintenance are temporarily unavailable because your landlord’s account status could not be verified. Please contact your landlord.'
            );
          }
        } else {
          setLandlordBillingBlocked(true);
          setLandlordBillingMsg(
            'Online payments and maintenance are temporarily unavailable because this tenant account is not linked to a landlord yet. Please contact your landlord.'
          );
        }

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

        if (!prop && t.owner_id) {
          const { data: propRows2, error: propError2 } = await supabase
            .from('properties')
            .select('id, name, unit_label, monthly_rent, next_due_date, owner_id')
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

        const effectiveRent = prop?.monthly_rent ?? t.monthly_rent ?? null;

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

        const firstDueDateISO = resolveFirstDueDateISO(
          t.lease_start,
          prop?.next_due_date || null
        );

        const rs = calculateRentStatus(effectiveRent, firstDueDateISO, payData);
        setRentStatus(rs);

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

  const handleBack = () => {
    router.back();
  };

  const handleLogOut = async () => {
    await supabase.auth.signOut();
    router.push('/tenant/login');
  };

  const handleToggleAutoPay = async () => {
    if (!tenant) return;

    if (landlordBillingBlocked) {
      setError(
        landlordBillingMsg ||
          'Automatic payments are temporarily unavailable because your landlord’s RentZentro account is not currently active.'
      );
      setSuccess(null);
      return;
    }

    setError(null);
    setSuccess(null);

    const effectiveRent = property?.monthly_rent ?? tenant.monthly_rent ?? null;

    if (!effectiveRent || effectiveRent <= 0) {
      setError(
        'Your rent amount is not set yet. Please contact your landlord before turning on automatic payments.'
      );
      return;
    }

    try {
      setAutoPayLoading(true);

      if (!autoPayEnabled) {
        const res = await fetch('/api/tenant-autopay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'enable', tenantId: tenant.id }),
        });

        const data = await res.json().catch(() => ({} as any));

        if (!res.ok || !data?.url) {
          throw new Error(
            data?.error || 'Failed to start automatic payment setup.'
          );
        }

        window.location.href = data.url as string;
      } else {
        const confirmOff = window.confirm(
          'Turn off automatic rent payments for this unit? You will need to pay rent manually each period.'
        );
        if (!confirmOff) return;

        const res = await fetch('/api/tenant-autopay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'disable', tenantId: tenant.id }),
        });

        const data = await res.json().catch(() => ({} as any));

        if (!res.ok) {
          throw new Error(data?.error || 'Failed to turn off automatic payments.');
        }

        setAutoPayEnabled(false);
        setSuccess(
          'Automatic rent payments have been turned off. You can still pay manually each month.'
        );
      }
    } catch (err: any) {
      console.error('handleToggleAutoPay error', err);
      setError(
        err?.message ||
          'Something went wrong updating automatic payments. Please try again.'
      );
    } finally {
      setAutoPayLoading(false);
    }
  };

  const startCheckout = async (paymentMethodType: 'card' | 'us_bank_account') => {
    if (!tenant) return;

    if (landlordBillingBlocked) {
      setError(
        landlordBillingMsg ||
          'Online rent payments are temporarily unavailable because your landlord’s RentZentro account is not currently active.'
      );
      setSuccess(null);
      return;
    }

    const baseRent = property?.monthly_rent ?? tenant.monthly_rent ?? 0;

    const today = new Date();
    const todayMidnight = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    const earliestDue = parseSupabaseDate(
      resolveFirstDueDateISO(tenant.lease_start, property?.next_due_date || null)
    );

    const earlyAllowed = !!tenant.allow_early_payment;
    const isBeforeFirstDue = !!earliestDue && todayMidnight < earliestDue;

    if (isBeforeFirstDue && !earlyAllowed) {
      setError(
        'Online rent payments are only available once your first rent due date arrives. Please try again on or after the due date.'
      );
      setSuccess(null);
      return;
    }

    const amount =
      rentStatus && rentStatus.outstanding > 0 ? rentStatus.outstanding : baseRent;

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
          description: `Rent payment for ${property?.name || 'your unit'}${
            property?.unit_label ? ` · ${property.unit_label}` : ''
          }`,
          tenantId: tenant.id,
          propertyId: property?.id ?? null,
          paymentMethodType,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.error || `Failed to create payment session (status ${res.status}).`
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
          `Something went wrong while starting your ${
            paymentMethodType === 'card' ? 'card' : 'bank'
          } payment. Please try again.`
      );
    } finally {
      setPaying(false);
    }
  };

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

  const currentRent = property?.monthly_rent ?? tenant.monthly_rent ?? null;

  const dueDateObj = parseSupabaseDate(
    (rentStatus?.nextDueDate as string | null) || property?.next_due_date || null
  );
  const today = new Date();
  const todayMidnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const isRentOverdue = !!dueDateObj && dueDateObj.getTime() < todayMidnight.getTime();

  const earliestDueDate =
    parseSupabaseDate(
      resolveFirstDueDateISO(tenant.lease_start, property?.next_due_date || null)
    ) || dueDateObj;
  const isBeforeDue = !!earliestDueDate && todayMidnight < earliestDueDate;
  const earlyAllowed = !!tenant.allow_early_payment;
  const isTooEarlyToPay = isBeforeDue && !earlyAllowed;

  const amountToPayNow =
    !isTooEarlyToPay && rentStatus && rentStatus.outstanding > 0
      ? rentStatus.outstanding
      : !isTooEarlyToPay
      ? currentRent
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

  const tenantActionsBlocked = landlordBillingBlocked;
  const localAreaHint = property?.name || property?.unit_label || null;

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

        {tenantActionsBlocked && (
          <div className="rounded-2xl border border-amber-500/50 bg-amber-950/40 px-4 py-3 text-[12px] text-amber-100">
            <p className="font-semibold text-amber-200">
              Payments & maintenance temporarily unavailable
            </p>
            <p className="mt-1 text-amber-100/90">
              {landlordBillingMsg ||
                'Your landlord’s RentZentro account is not currently active, so online payments and maintenance requests are temporarily disabled.'}
            </p>
          </div>
        )}

        <header className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <button
              type="button"
              onClick={handleBack}
              className="text-[11px] text-slate-500 hover:text-emerald-300"
            >
              ← Back
            </button>
            <h1 className="text-lg font-semibold text-slate-50">Tenant portal</h1>
            <p className="text-[11px] text-slate-400">
              View your rent details, lease info, documents, and payment history.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-right">
            <div className="text-xs">
              <p className="font-medium text-slate-100">{tenant.name || 'Tenant'}</p>
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

        <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)]">
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Current rent</p>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="text-2xl font-semibold text-slate-50">
                  {formatCurrency(currentRent)}
                </p>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Next due date:{' '}
                <span className="text-slate-200">
                  {formatDate(
                    (rentStatus?.nextDueDate as string | null) ||
                      property?.next_due_date
                  )}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Property:{' '}
                <span className="text-slate-200">
                  {property?.name || 'Not set'}
                  {property?.unit_label ? ` · ${property.unit_label}` : ''}
                </span>
              </p>

              {currentRent != null && rentStatus && (
                <>
                  <p className="mt-2 text-xs text-slate-400">
                    Total paid toward rent:{' '}
                    <span className="text-slate-200">
                      {formatCurrency(rentStatus.totalPaid)}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Total outstanding rent:{' '}
                    <span className="text-slate-200">
                      {formatCurrency(rentStatus.outstanding)}
                    </span>
                  </p>
                </>
              )}

              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-2.5 text-[11px]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-100">Automatic payments</p>
                    <p className="text-slate-400">
                      {tenantActionsBlocked
                        ? 'Automatic payments are temporarily unavailable.'
                        : autoPayEnabled
                        ? 'Rent will be charged automatically each period using your saved payment method.'
                        : 'Set up automatic rent payments so you don’t have to remember each month.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleAutoPay}
                    disabled={autoPayLoading || tenantActionsBlocked}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                      autoPayEnabled
                        ? 'bg-emerald-500 border-emerald-400'
                        : 'bg-slate-800 border-slate-600'
                    } ${
                      autoPayLoading || tenantActionsBlocked
                        ? 'opacity-60 cursor-not-allowed'
                        : ''
                    }`}
                    title={tenantActionsBlocked ? 'Temporarily unavailable' : undefined}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        autoPayEnabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  You&apos;ll be taken to a secure Stripe page to set up or update automatic
                  payments. You can turn this off at any time.
                </p>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => startCheckout('us_bank_account')}
                  disabled={
                    paying ||
                    tenantActionsBlocked ||
                    isTooEarlyToPay ||
                    !amountToPayNow ||
                    amountToPayNow <= 0
                  }
                  className="w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {paying
                    ? 'Starting payment…'
                    : tenantActionsBlocked
                    ? 'Payments temporarily unavailable'
                    : isTooEarlyToPay
                    ? 'Online payment not available until due date'
                    : 'Pay with bank (ACH) — $5 fee'}
                </button>

                <button
                  type="button"
                  onClick={() => startCheckout('card')}
                  disabled={
                    paying ||
                    tenantActionsBlocked ||
                    isTooEarlyToPay ||
                    !amountToPayNow ||
                    amountToPayNow <= 0
                  }
                  className="w-full rounded-full bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-50 border border-slate-600 shadow-sm hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {paying
                    ? 'Starting payment…'
                    : tenantActionsBlocked
                    ? 'Payments temporarily unavailable'
                    : isTooEarlyToPay
                    ? 'Online payment not available until due date'
                    : 'Pay with card — 3.5% fee'}
                </button>
              </div>

              {!tenantActionsBlocked && !isTooEarlyToPay && amountToPayNow && (
                <p className="mt-3 text-xs text-slate-400">
                  Amount due now:{' '}
                  <span className="font-medium text-slate-200">
                    {formatCurrency(amountToPayNow)}
                  </span>
                </p>
              )}

              {isTooEarlyToPay && (
                <p className="mt-3 text-[11px] text-amber-300">
                  Online rent payments are not available until your due date unless your landlord
                  allows early payment.
                </p>
              )}

              <p className="mt-3 text-[11px] text-slate-500">
                Bank payments include a $5 processing fee. Card payments include a 3.5%
                convenience fee. Payments are processed securely by Stripe and you&apos;ll get a
                confirmation once your payment is completed.
              </p>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Payment history</p>
                  <p className="mt-1 text-sm font-medium text-slate-50">Your recent payments</p>
                </div>
              </div>

              {payments.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">No rent payments recorded yet.</p>
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
                        <p className="text-[11px] text-slate-300">{p.method || 'Payment'}</p>
                        {p.note && (
                          <p className="mt-0.5 text-[10px] text-slate-500">{p.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-3 text-[11px] text-slate-500">
                Note: A successful payment here means Stripe confirmed the payment. Bank payouts to
                your landlord can take additional time.
              </p>
            </section>
          </div>

          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Account status</p>
              <h2 className="mt-1 text-sm font-semibold text-slate-50">
                {tenant.name || 'Tenant account'}
              </h2>
              <p className="mt-1 text-xs text-slate-400">{tenant.email}</p>

              <div className={accountStatusClasses}>
                <span className={accountStatusDotClasses} />
                {accountStatusLabel}
              </div>

              <div className="mt-4 space-y-2 text-xs text-slate-400">
                <p>
                  Lease start:{' '}
                  <span className="text-slate-200">{formatDate(tenant.lease_start)}</span>
                </p>
                <p>
                  Lease end:{' '}
                  <span className="text-slate-200">{formatDate(tenant.lease_end)}</span>
                </p>
                <p>
                  Monthly rent:{' '}
                  <span className="text-slate-200">{formatCurrency(currentRent)}</span>
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Documents</p>
                  <p className="mt-1 text-sm font-medium text-slate-50">Your shared files</p>
                </div>
              </div>

              {documents.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">No documents have been shared yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {documents.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 hover:border-emerald-500/40"
                    >
                      <p className="text-sm font-medium text-slate-100">{doc.title}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Added {formatDateTime(doc.created_at)}
                      </p>
                    </a>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Maintenance</p>
                  <p className="mt-1 text-sm font-medium text-slate-50">Recent requests</p>
                </div>
                <Link
                  href="/tenant/maintenance"
                  className="text-[11px] text-emerald-300 hover:text-emerald-200"
                >
                  View all
                </Link>
              </div>

              {maintenance.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">
                  No maintenance requests submitted yet.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {maintenance.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-100">{item.title}</p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {formatDateTime(item.created_at)}
                          </p>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium ${statusBadgeClasses(
                            item.status
                          )}`}
                        >
                          {formatStatusLabel(item.status)}
                        </span>
                      </div>

                      {item.description && (
                        <p className="mt-2 text-xs text-slate-300">{item.description}</p>
                      )}

                      {item.resolution_note && (
                        <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">
                            Resolution note
                          </p>
                          <p className="mt-1 text-xs text-slate-300">
                            {item.resolution_note}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3">
                <Link
                  href="/tenant/maintenance"
                  className={`inline-flex rounded-md px-3 py-2 text-[11px] font-medium border ${
                    tenantActionsBlocked
                      ? 'bg-slate-900 text-slate-500 border-slate-800 pointer-events-none'
                      : 'bg-slate-900 text-slate-100 border-slate-600 hover:bg-slate-800'
                  }`}
                >
                  Submit maintenance request
                </Link>
              </div>
            </section>

            <ExploreNearbySection
              areaHint={localAreaHint}
              propertyName={property?.name || null}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
