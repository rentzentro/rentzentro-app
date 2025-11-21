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

type DocumentRow = {
  id: number;
  created_at: string;
  title: string;
  file_url: string;
  property_id: number | null;
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
  if (Number.isNaN(d.getTime())) return '-';

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

// ---------- Component ----------

export default function TenantPortalPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [property, setProperty] = useState<PropertyRow | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

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
        const email = authData.user?.email;
        if (!email) {
          throw new Error('Unable to load tenant: missing email.');
        }

        // Tenant
        const { data: tenantRows, error: tenantError } = await supabase
          .from('tenants')
          .select('*')
          .eq('email', email)
          .limit(1);

        if (tenantError) throw tenantError;
        const t = (tenantRows && tenantRows[0]) as TenantRow | undefined;
        if (!t) {
          throw new Error('Tenant not found for logged-in user.');
        }

        setTenant(t);

        // Property
        if (t.property_id) {
          const { data: propRow, error: propError } = await supabase
            .from('properties')
            .select('*')
            .eq('id', t.property_id)
            .single();

          if (propError) throw propError;
          setProperty(propRow as PropertyRow);
        } else {
          setProperty(null);
        }

        // Payments
        const { data: payRows, error: payError } = await supabase
          .from('payments')
          .select('*')
          .eq('tenant_id', t.id)
          .order('paid_on', { ascending: false })
          .limit(10);

        if (payError) throw payError;
        setPayments((payRows || []) as PaymentRow[]);

        // Documents
        if (t.property_id) {
          const { data: docRows, error: docError } = await supabase
            .from('documents')
            .select('id, created_at, title, file_url, property_id')
            .eq('property_id', t.property_id)
            .order('created_at', { ascending: false });

          if (docError) throw docError;
          setDocuments((docRows || []) as DocumentRow[]);
        } else {
          setDocuments([]);
        }

        // Recent maintenance requests (show a few on portal)
        const { data: maintRows, error: maintError } = await supabase
          .from('maintenance_requests')
          .select('*')
          .eq('tenant_id', t.id)
          .order('created_at', { ascending: false })
          .limit(4);

        if (maintError) throw maintError;
        setMaintenance((maintRows || []) as MaintenanceRow[]);
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

  const handlePayWithCard = async () => {
    if (!tenant) return;

    const amount =
      property?.monthly_rent ??
      tenant.monthly_rent ??
      0;

    if (!amount || amount <= 0) {
      setError(
        'Your monthly rent amount is not set. Please contact your landlord.'
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
        <p className="text-sm text-slate-400">
          Loading your tenant portal…
        </p>
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
    property?.monthly_rent ??
    tenant.monthly_rent ??
    null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-4">
        {/* Global banner */}
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
              View your rent details, lease info, documents, and payment history.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-right">
            <div className="text-xs">
              <p className="font-medium text-slate-100">
                {tenant.name || 'Tenant'}
              </p>
              <p className="text-slate-400 text-[11px]">
                {tenant.email}
              </p>
            </div>
            <button
              onClick={handleLogOut}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
            >
              Log out
            </button>
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

              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handlePayWithCard}
                  disabled={paying}
                  className="w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
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

              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-950/40 px-3 py-1 text-[11px] text-emerald-100">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {tenant.status?.toLowerCase() === 'current'
                  ? 'Current tenant in good standing'
                  : tenant.status || 'Status not set'}
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

            {/* Maintenance overview (separate card) */}
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
              <p className="mt-1 text-[10px] text-slate-500">
                For true emergencies (fire, active flooding, gas smells, or
                anything life-threatening), call your local emergency services
                first, then contact your landlord or property manager directly.
              </p>

              {/* Recent requests */}
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

              {/* Buttons */}
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
