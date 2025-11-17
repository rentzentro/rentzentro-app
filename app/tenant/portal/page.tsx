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
  name: string | null;
  unit_label: string | null;
  monthly_rent: number | null;
  status: string | null;
  next_due_date: string | null;
};

type PaymentRow = {
  id: number;
  created_at: string;
  tenant_id: number | null;
  property_id: number | null;
  amount: number | null;
  paid_on: string | null;
  method: string | null;
  note: string | null;
};

function formatCurrency(value: number | null | undefined) {
  if (value == null || isNaN(value)) return '-';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
}

function formatDate(isoDate: string | null | undefined) {
  if (!isoDate) return '-';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function TenantPortalPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [property, setProperty] = useState<PropertyRow | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [paying, setPaying] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadTenant = async () => {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      // 1) Get current session
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
        router.push('/tenant/login');
        return;
      }

      const email = session.user.email?.toLowerCase().trim();

      if (!email) {
        setError(
          'No email associated with this account. Please contact your landlord.'
        );
        setLoading(false);
        return;
      }

      // 2) Load tenant row by email
      const { data: tenantRow, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (tenantError) {
        console.error('Tenant portal – tenant error:', tenantError);
        setError('There was a problem loading your tenant details.');
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

      const typedTenant = tenantRow as TenantRow;
      setTenant(typedTenant);

      // 3) Load property (if linked)
      if (typedTenant.property_id) {
        const {
          data: propertyRow,
          error: propertyError,
        } = await supabase
          .from('properties')
          .select('*')
          .eq('id', typedTenant.property_id)
          .maybeSingle();

        if (propertyError) {
          console.error('Tenant portal – property error:', propertyError);
        } else if (propertyRow) {
          setProperty(propertyRow as PropertyRow);
        }
      }

      // 4) Load payment history for this tenant
      const { data: paymentRows, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', typedTenant.id)
        .order('paid_on', { ascending: false });

      if (paymentError) {
        console.error('Tenant portal – payments error:', paymentError);
      } else if (paymentRows) {
        setPayments(paymentRows as PaymentRow[]);
      }

      setLoading(false);
    };

    loadTenant();
  }, [router]);

  const rentAmount =
    tenant?.monthly_rent ?? property?.monthly_rent ?? null;

  const nextDueLabel = property?.next_due_date
    ? formatDate(property.next_due_date)
    : 'See lease or ask landlord';

  const statusBadgeColor =
    tenant?.status?.toLowerCase() === 'current'
      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
      : tenant?.status?.toLowerCase() === 'late'
      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/40'
      : 'bg-slate-500/10 text-slate-300 border border-slate-500/40';

  // --- Real Stripe card payment (Stripe Checkout) ---
  const handlePayWithCard = async () => {
    if (!tenant) {
      setError('You must be logged in as a tenant to start a payment.');
      return;
    }
    if (rentAmount == null || rentAmount <= 0) {
      setError(
        'No rent amount is set for your account yet. Please ask your landlord to configure your lease.'
      );
      return;
    }

    setPaying(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: rentAmount,
          description:
            property && property.name
              ? `Rent payment for ${property.name}${
                  property.unit_label ? ' · ' + property.unit_label : ''
                }`
              : 'Rent payment',
          tenantId: tenant.id,
          propertyId: property?.id ?? null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as any).error || 'There was a problem starting your payment.'
        );
      }

      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url as string;
      } else {
        throw new Error(
          'Unable to start secure payment. Please try again or contact your landlord.'
        );
      }
    } catch (err: any) {
      console.error('Stripe pay error:', err);
      setError(
        err?.message ||
          'There was a problem connecting to the payment processor. Please try again.'
      );
      setPaying(false);
    }
  };

  // --- Payment simulation: mark rent as paid ---
  const handlePayRent = async () => {
    if (!tenant) {
      setError('You must be logged in as a tenant to record a payment.');
      return;
    }
    if (rentAmount == null || rentAmount <= 0) {
      setError(
        'No rent amount is set for your account yet. Please ask your landlord to configure your lease.'
      );
      return;
    }

    setPaying(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // 1) Insert payment row
      const now = new Date();
      const paidOnIso = now.toISOString();

      const { data: inserted, error: insertError } = await supabase
        .from('payments')
        .insert({
          tenant_id: tenant.id,
          property_id: property?.id ?? null,
          amount: rentAmount,
          paid_on: paidOnIso,
          method: 'Recorded in portal (simulated)',
          note: 'Simulated in-app payment for testing (no real funds moved).',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Pay rent - insert error:', insertError);
        setError(
          insertError.message || 'There was a problem recording your payment.'
        );
        setPaying(false);
        return;
      }

      // Add to local payment history
      if (inserted) {
        setPayments((prev) => [inserted as PaymentRow, ...prev]);
      }

      // 2) Optionally bump next_due_date forward by ~1 month
      if (property?.id && property?.next_due_date) {
        const currentDue = new Date(property.next_due_date);
        if (!isNaN(currentDue.getTime())) {
          const newDue = new Date(currentDue);
          newDue.setMonth(newDue.getMonth() + 1);

          const { error: updateError } = await supabase
            .from('properties')
            .update({
              next_due_date: newDue.toISOString(),
            })
            .eq('id', property.id);

          if (updateError) {
            console.error(
              'Pay rent - failed to update next_due_date:',
              updateError
            );
          } else {
            setProperty((prev) =>
              prev
                ? { ...prev, next_due_date: newDue.toISOString() }
                : prev
            );
          }
        }
      }

      setSuccessMessage('Payment recorded for your account (simulation only).');
      setPaying(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'There was a problem recording your payment.');
    } finally {
      setPaying(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/tenant/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto flex max-w-5xl flex-col px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-300">
            Loading your tenant portal…
          </div>
        </div>
      </div>
    );
  }

  if (error && !tenant) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto flex max-w-5xl flex-col px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <div className="mt-10 rounded-2xl border border-rose-500/40 bg-rose-950/40 p-6 text-sm text-rose-100">
            <p className="font-medium">There was a problem</p>
            <p className="mt-2 text-[13px] text-rose-100/80">{error}</p>
            <button
              onClick={() => router.push('/tenant/login')}
              className="mt-4 inline-flex items-center rounded-full bg-rose-500 px-4 py-1.5 text-xs font-semibold text-rose-950 hover:bg-rose-400"
            >
              Go to tenant login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto flex max-w-5xl flex-col px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-300">
            No tenant information found.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        {/* Breadcrumb / top row */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Link
                href="/tenant"
                className="text-slate-400 hover:text-emerald-300"
              >
                Tenant
              </Link>
              <span className="text-slate-600">/</span>
              <span className="text-slate-200">Portal</span>
            </div>
            <h1 className="text-lg font-semibold text-slate-50 sm:text-xl">
              Tenant portal
            </h1>
            <p className="text-[13px] text-slate-400">
              View your rent details, lease info, and payment history.
            </p>
          </div>

          <button
            onClick={handleSignOut}
            className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>

        {/* Any global error / success messages */}
        {(error || successMessage) && (
          <div className="mb-5 space-y-2 text-xs">
            {error && (
              <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-rose-100">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-emerald-100">
                {successMessage}
              </div>
            )}
          </div>
        )}

        {/* Layout: left column (rent / lease) + right (status / summary) */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)]">
          {/* Left column */}
          <div className="space-y-4">
            {/* Rent overview + actions */}
            <section className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-950/80 p-4 shadow-sm shadow-slate-900/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Current rent
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-slate-50">
                    {formatCurrency(rentAmount)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Next due date:{' '}
                    <span className="text-slate-200">{nextDueLabel}</span>
                  </p>
                  {property?.name && (
                    <p className="mt-2 text-xs text-slate-500">
                      Property:{' '}
                      <span className="text-slate-200">
                        {property.name}
                        {property.unit_label
                          ? ` · ${property.unit_label}`
                          : ''}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <button
                  onClick={handlePayWithCard}
                  disabled={paying || rentAmount == null}
                  className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {paying
                    ? 'Redirecting to secure payment…'
                    : 'Pay rent securely with card'}
                </button>
                <button
                  onClick={handlePayRent}
                  disabled={paying || rentAmount == null}
                  className="w-full rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-60"
                >
                  {paying ? 'Recording payment…' : 'Mark rent as paid (manual)'}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Card payments are processed securely by Stripe. Manual payments
                are only for recording rent you already paid outside of
                RentZentro.
              </p>
            </section>

            {/* Payment history */}
            <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 shadow-sm shadow-slate-950/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Payment history
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-50">
                    Your recent payments
                  </p>
                </div>
              </div>

              {payments.length === 0 ? (
                <p className="mt-4 text-xs text-slate-500">
                  No payments recorded yet for your account.
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-100">
                          {formatCurrency(payment.amount)}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {payment.paid_on
                            ? formatDate(payment.paid_on)
                            : 'No date'}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[11px] text-slate-400">
                          {payment.method || 'Method not specified'}
                        </span>
                        {payment.note && (
                          <span className="mt-0.5 max-w-[200px] truncate text-[11px] text-slate-500">
                            {payment.note}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-3 text-[11px] text-slate-500">
                In a future update, real online card or bank payments will
                appear here automatically after processing.
              </p>
            </section>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Status card */}
            <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-950/80 p-4 shadow-sm shadow-slate-900/40">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Account status
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-50">
                    {tenant.name || 'Tenant'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {tenant.email || 'No email on file'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeColor}`}
                  >
                    {tenant.status || 'Unknown'}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Keep your payments up to date to maintain a good standing with
                your landlord.
              </p>
              <p className="mt-3 text-[11px] text-slate-500">
                Any questions about your balance or status? Contact your
                landlord directly.
              </p>
            </div>

            {/* Lease details */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 shadow-sm shadow-slate-950/40">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Lease details
              </p>
              <p className="mt-1 text-sm font-medium text-slate-50">
                Lease & contact info
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Review your lease dates and the contact details RentZentro has
                on file.
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
                    Tenant phone
                  </dt>
                  <dd className="mt-1 text-slate-100">
                    {tenant.phone || 'Not provided'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">
                    Unit
                  </dt>
                  <dd className="mt-1 text-slate-100">
                    {property?.name
                      ? `${property.name}${
                          property.unit_label ? ' · ' + property.unit_label : ''
                        }`
                      : 'Not linked yet'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
