'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

// ---------- Types ----------

type TenantRow = {
  id: number;
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

// ---------- Component ----------

export default function TenantPortalPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [property, setProperty] = useState<PropertyRow | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  // ---------- Load tenant, property, payments ----------

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.push('/tenant/login');
        return;
      }

      const email = session.user.email?.toLowerCase().trim();
      if (!email) {
        setError('No email found on this account.');
        setLoading(false);
        return;
      }

      const { data: tRow, error: tErr } = await supabase
        .from('tenants')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (tErr) {
        console.error(tErr);
        setError('Unable to load tenant data.');
        setLoading(false);
        return;
      }
      if (!tRow) {
        setError('No tenant record found. Ask your landlord to add you.');
        setLoading(false);
        return;
      }

      const t = tRow as TenantRow;
      setTenant(t);

      if (t.property_id) {
        const { data: pRow, error: pErr } = await supabase
          .from('properties')
          .select('*')
          .eq('id', t.property_id)
          .maybeSingle();

        if (pErr) console.error(pErr);
        if (pRow) setProperty(pRow as PropertyRow);
      }

      const { data: payRows, error: payErr } = await supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', t.id)
        .order('paid_on', { ascending: false });

      if (payErr) console.error(payErr);
      if (payRows) setPayments(payRows as PaymentRow[]);

      setLoading(false);
    };

    load();
  }, [router]);

  const rentAmount =
    tenant?.monthly_rent ?? property?.monthly_rent ?? null;

  const nextDueLabel = property?.next_due_date
    ? formatDate(property.next_due_date)
    : 'See lease or ask landlord';

  const statusBadge =
    tenant?.status?.toLowerCase() === 'current'
      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
      : tenant?.status?.toLowerCase() === 'late'
      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40'
      : 'bg-slate-500/15 text-slate-300 border border-slate-500/40';

  // ---------- Stripe Checkout ----------

  const handlePayWithCard = async () => {
    if (!rentAmount || rentAmount <= 0) {
      setError('Rent amount not configured yet. Ask your landlord.');
      return;
    }

    setPaying(true);
    setError(null);
    setSuccessMessage(null);

    const origin = window.location.origin;

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: rentAmount,
          successUrl: `${origin}/tenant/payment-success`,
          cancelUrl: `${origin}/tenant/payment-cancelled`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Could not start payment.');
      }

      window.location.href = data.url as string;
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unexpected error starting payment.');
      setPaying(false);
    }
  };

  // ---------- Manual "Mark as paid" for testing ----------

  const handleMarkPaid = async () => {
    if (!tenant) return;
    if (!rentAmount || rentAmount <= 0) {
      setError('Rent amount not configured.');
      return;
    }

    setPaying(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const now = new Date().toISOString();

      const { data: inserted, error: insertErr } = await supabase
        .from('payments')
        .insert({
          tenant_id: tenant.id,
          property_id: property?.id ?? null,
          amount: rentAmount,
          paid_on: now,
          method: 'Recorded in portal (manual)',
          note: 'Manually marked as paid by tenant (testing).',
        })
        .select()
        .single();

      if (insertErr) {
        console.error(insertErr);
        setError(insertErr.message || 'Could not record payment.');
        setPaying(false);
        return;
      }

      if (inserted) {
        setPayments((prev) => [inserted as PaymentRow, ...prev]);
      }

      // Optional: bump due date 1 month ahead
      if (property?.id && property.next_due_date) {
        const cur = new Date(property.next_due_date);
        if (!isNaN(cur.getTime())) {
          const next = new Date(cur);
          next.setMonth(next.getMonth() + 1);
          await supabase
            .from('properties')
            .update({ next_due_date: next.toISOString() })
            .eq('id', property.id);

          setProperty((prev) =>
            prev ? { ...prev, next_due_date: next.toISOString() } : prev
          );
        }
      }

      setSuccessMessage('Payment recorded (manual only, no real funds moved).');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unexpected error recording payment.');
    } finally {
      setPaying(false);
    }
  };

  // ---------- Sign out ----------

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/tenant/login');
  };

  // ---------- UI States ----------

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 p-6">
        <p>Loading tenant portal…</p>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 p-6">
        <p>No tenant found.</p>
      </div>
    );
  }

  // ---------- Main UI ----------

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="text-xs text-slate-500 flex gap-2">
              <Link href="/tenant" className="hover:text-emerald-400">
                Tenant
              </Link>
              <span>/</span>
              <span className="text-slate-300">Portal</span>
            </div>
            <h1 className="text-xl font-semibold mt-1 text-slate-50">
              Tenant portal
            </h1>
            <p className="text-[13px] text-slate-400">
              View your rent, lease details, and payment history.
            </p>
          </div>

          <button
            onClick={handleSignOut}
            className="text-xs px-4 py-2 border border-slate-700 rounded-full hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>

        {/* Messages */}
        {(error || successMessage) && (
          <div className="mb-4 space-y-2 text-sm">
            {error && (
              <div className="p-3 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-100">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-100">
                {successMessage}
              </div>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)] gap-4">
          {/* LEFT COLUMN */}
          <div className="space-y-4">
            {/* Rent Card */}
            <section className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800 shadow-sm">
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Current rent
              </p>
              <p className="text-3xl font-semibold mt-1 text-slate-50">
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
                    {property.unit_label ? ` · ${property.unit_label}` : ''}
                  </span>
                </p>
              )}

              <div className="mt-4 space-y-2">
                <button
                  disabled={paying || !rentAmount}
                  onClick={handlePayWithCard}
                  className="w-full rounded-xl bg-emerald-500 text-slate-950 font-semibold py-2 text-sm hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {paying
                    ? 'Redirecting to secure payment…'
                    : 'Pay rent securely with card'}
                </button>
                <button
                  disabled={paying || !rentAmount}
                  onClick={handleMarkPaid}
                  className="w-full rounded-xl border border-emerald-500/60 bg-emerald-500/10 text-emerald-200 text-sm py-2 hover:bg-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Mark rent as paid (manual)
                </button>
              </div>

              <p className="mt-2 text-[11px] text-slate-500">
                Card payments are processed securely by Stripe. Manual payments
                only record rent you already paid outside of RentZentro.
              </p>
            </section>

            {/* Payment history */}
            <section className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 shadow-sm">
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Payment history
              </p>
              <p className="mt-1 text-sm font-medium text-slate-50">
                Your recent payments
              </p>

              {payments.length === 0 ? (
                <p className="mt-4 text-xs text-slate-500">
                  No payments recorded yet.
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex justify-between items-center px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/70 text-xs"
                    >
                      <div>
                        <p className="font-medium text-slate-100">
                          {formatCurrency(p.amount)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {formatDate(p.paid_on)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-slate-400">
                          {p.method || 'Method not specified'}
                        </p>
                        {p.note && (
                          <p className="text-[11px] text-slate-500 max-w-[200px] truncate">
                            {p.note}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-3 text-[11px] text-slate-500">
                In a future update, real online card or bank payments will show
                here automatically after processing.
              </p>
            </section>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4">
            {/* Account status */}
            <section className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800 shadow-sm">
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Account status
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-50">
                    {tenant.name || 'Tenant'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {tenant.email || 'No email on file'}
                  </p>
                  {tenant.phone && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Phone: <span className="text-slate-200">{tenant.phone}</span>
                    </p>
                  )}
                </div>
                <span
                  className={
                    'text-xs px-3 py-1 rounded-full font-medium ' + statusBadge
                  }
                >
                  {tenant.status || 'Unknown'}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Keep your payments up to date to maintain a good standing with
                your landlord.
              </p>
            </section>

            {/* Lease details */}
            <section className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 shadow-sm">
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Lease details
              </p>
              <p className="mt-1 text-sm font-medium text-slate-50">
                Lease & contact info
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Review your lease dates and the contact details RentZentro has
                on file.
              </p>

              <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-slate-500 uppercase">
                    Lease start
                  </dt>
                  <dd className="mt-1 text-slate-100">
                    {formatDate(tenant.lease_start)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 uppercase">
                    Lease end
                  </dt>
                  <dd className="mt-1 text-slate-100">
                    {formatDate(tenant.lease_end)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 uppercase">
                    Property
                  </dt>
                  <dd className="mt-1 text-slate-100">
                    {property?.name
                      ? `${property.name}${
                          property.unit_label ? ' · ' + property.unit_label : ''
                        }`
                      : 'Not linked yet'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 uppercase">
                    Tenant phone
                  </dt>
                  <dd className="mt-1 text-slate-100">
                    {tenant.phone || 'Not provided'}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
