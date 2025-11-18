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
  status: string | null;
  property_id: number | null;
  monthly_rent: number | null;
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
  const [paying, setPaying] = useState(false);

  // ---------- Load tenant + related data ----------

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1) Get current auth user
        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError) throw authError;
        const email = authData.user?.email;
        if (!email) {
          throw new Error('Unable to load tenant: missing email.');
        }

        // 2) Find tenant record by email
        const { data: tenantRows, error: tenantError } = await supabase
          .from('tenants')
          .select('*')
          .eq('email', email)
          .limit(1);

        if (tenantError) throw tenantError;
        const t = (tenantRows || [])[0] as TenantRow | undefined;
        if (!t) {
          throw new Error(
            "We couldn't find your tenant record. Please contact your landlord."
          );
        }

        setTenant(t);

        // 3) Load property (if linked)
        let prop: PropertyRow | null = null;
        if (t.property_id) {
          const { data: propRows, error: propError } = await supabase
            .from('properties')
            .select('*')
            .eq('id', t.property_id)
            .limit(1);

          if (propError) throw propError;
          prop = (propRows || [])[0] as PropertyRow | undefined || null;
        }
        setProperty(prop);

        // 4) Recent payments for this tenant
        const { data: payRows, error: payError } = await supabase
          .from('payments')
          .select('*')
          .eq('tenant_id', t.id)
          .order('paid_on', { ascending: false })
          .limit(10);

        if (payError) throw payError;
        setPayments((payRows || []) as PaymentRow[]);
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

  const handlePayWithCard = async () => {
    if (!tenant) {
      setError('Unable to start payment: missing tenant record.');
      return;
    }

    const amount =
      tenant.monthly_rent ??
      property?.monthly_rent ??
      null;

    if (!amount || isNaN(amount)) {
      setError(
        'Unable to start payment: monthly rent is not set. Please contact your landlord.'
      );
      return;
    }

    setPaying(true);
    setError(null);

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

      // 🔁 Redirect straight to Stripe Checkout
      window.location.href = data.url as string;
    } catch (err: any) {
      console.error('Stripe Checkout Error:', err);
      setError(
        err?.message ||
          'Unexpected error starting payment. Please try again or contact support.'
      );
    } finally {
      setPaying(false);
    }
  };

  // ---------- UI ----------

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 p-6">
        <p>Loading your tenant portal…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Top bar with back button + breadcrumb */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xs text-slate-500 flex gap-2">
              <button
                type="button"
                onClick={handleBack}
                className="text-slate-400 hover:text-emerald-400 underline-offset-2 hover:underline"
              >
                ← Back
              </button>
              <span className="hidden sm:inline">/</span>
              <span className="hidden sm:inline text-slate-300">
                Tenant / Portal
              </span>
            </div>
            <h1 className="text-xl font-semibold mt-1 text-slate-50">
              Tenant portal
            </h1>
            <p className="text-[13px] text-slate-400">
              View your rent details, lease info, and payment history.
            </p>
          </div>

          <div className="text-right text-xs text-slate-400">
            <p className="text-slate-300 font-medium">
              {tenant?.name || 'Tenant account'}
            </p>
            <p className="truncate max-w-[180px]">{tenant?.email}</p>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 rounded-2xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        {/* Main layout: left = rent + history, right = account + lease */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)]">
          {/* LEFT COLUMN */}
          <div className="space-y-4">
            {/* Current rent card */}
            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Current rent
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-50">
                {formatCurrency(
                  tenant?.monthly_rent ?? property?.monthly_rent ?? null
                )}
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Next due date:{' '}
                <span className="text-slate-200">
                  {formatDate(property?.next_due_date)}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Property:{' '}
                <span className="text-slate-200">
                  {property?.name || 'Not set'}
                  {property?.unit_label ? ` · ${property.unit_label}` : ''}
                </span>
              </p>

              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handlePayWithCard}
                  disabled={paying}
                  className="w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {paying ? 'Starting payment…' : 'Pay rent securely with card'}
                </button>

                <Link
                  href="/tenant/payment-success"
                  className="w-full text-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 hover:bg-slate-800"
                >
                  Mark rent as paid (manual)
                </Link>
              </div>

              <p className="mt-3 text-[11px] text-slate-500">
                Card payments are processed securely by Stripe. Manual payments
                are only for recording rent you already paid outside of
                RentZentro.
              </p>
            </section>

            {/* Payment history */}
            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
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
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2"
                    >
                      <div>
                        <p className="font-medium text-slate-100">
                          {formatCurrency(p.amount)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {formatDate(p.paid_on)} •{' '}
                          {p.method || 'Method not specified'}
                        </p>
                      </div>
                      {p.note && (
                        <p className="max-w-[200px] truncate text-[11px] text-slate-500 text-right">
                          {p.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4">
            {/* Account status */}
            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Account status
              </p>
              <h2 className="mt-1 text-sm font-semibold text-slate-50">
                {tenant?.name || 'Tenant account'}
              </h2>
              <p className="mt-1 text-xs text-slate-400">{tenant?.email}</p>

              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-950/40 px-3 py-1 text-[11px] text-emerald-100">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {tenant?.status?.toLowerCase() === 'current'
                  ? 'Current tenant in good standing'
                  : tenant?.status || 'Status not set'}
              </div>

              <p className="mt-3 text-[11px] text-slate-500">
                Any questions about your balance or status? Contact your
                landlord directly.
              </p>
            </section>

            {/* Lease details */}
            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Lease & contact info
              </p>
              <p className="mt-1 text-sm font-medium text-slate-50">
                Lease details
              </p>

              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Lease start</dt>
                  <dd className="text-slate-200">
                    {formatDate(tenant?.lease_start)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Lease end</dt>
                  <dd className="text-slate-200">
                    {formatDate(tenant?.lease_end)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Tenant phone</dt>
                  <dd className="text-slate-200">
                    {tenant?.phone || 'Not provided'}
                  </dd>
                </div>
              </dl>

              <p className="mt-3 text-[11px] text-slate-500">
                For changes to your lease, rent amount, or due date, please
                reach out to your landlord or property manager.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
