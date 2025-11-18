'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';

type Tenant = {
  id: number;
  name: string | null;
  email: string | null;
  phone?: string | null;
  status?: string | null;
  property_id: number | null;
  lease_start?: string | null;
  lease_end?: string | null;
};

type Property = {
  id: number;
  name: string | null;
  unit_label: string | null;
  monthly_rent: number | null;
  next_due_date?: string | null;
};

type Payment = {
  id: number;
  amount: number | null;
  paid_on: string | null;
  method: string | null;
  note: string | null;
};

export default function TenantPortalPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      // 1) Load the FIRST tenant in the table (your test tenant)
      const {
        data: tenantRows,
        error: tenantError,
      } = await supabase
        .from('tenants')
        .select(
          'id, name, email, phone, status, property_id, lease_start, lease_end'
        )
        .order('id', { ascending: true })
        .limit(1);

      if (tenantError || !tenantRows || tenantRows.length === 0) {
        console.error('Error loading tenant:', tenantError);
        setError('Unable to load tenant information (no tenant records found).');
        setLoading(false);
        return;
      }

      const tenantRow = tenantRows[0];
      setTenant(tenantRow);

      // 2) Property for that tenant
      if (tenantRow.property_id) {
        const { data: propRow, error: propError } = await supabase
          .from('properties')
          .select('id, name, unit_label, monthly_rent, next_due_date')
          .eq('id', tenantRow.property_id)
          .single();

        if (propError) {
          console.error('Error loading property:', propError);
        } else {
          setProperty(propRow);
        }
      }

      // 3) Payment history for that tenant
      const {
        data: paymentRows,
        error: paymentsError,
      } = await supabase
        .from('payments')
        .select('id, amount, paid_on, method, note')
        .eq('tenant_id', tenantRow.id)
        .order('paid_on', { ascending: false })
        .limit(20);

      if (paymentsError) {
        console.error('Error loading payments:', paymentsError);
      } else {
        setPayments(paymentRows || []);
      }

      setLoading(false);
    };

    loadData();
  }, []);

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return iso;
    }
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const formatAmount = (amount: number | null | undefined) => {
    if (amount == null) return '—';
    return `$${amount.toFixed(2)}`;
  };

  const getDueStatus = (nextDueDate?: string | null) => {
    if (!nextDueDate) {
      return {
        label: 'No due date on file',
        className: 'bg-slate-800 text-slate-200',
      };
    }

    const now = new Date();
    const due = new Date(nextDueDate);
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: 'Overdue',
        className:
          'bg-rose-500/15 text-rose-300 border border-rose-500/40',
      };
    }

    if (diffDays === 0) {
      return {
        label: 'Due today',
        className:
          'bg-amber-500/15 text-amber-300 border border-amber-500/40',
      };
    }

    if (diffDays <= 7) {
      return {
        label: `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}`,
        className:
          'bg-amber-500/10 text-amber-200 border border-amber-500/30',
      };
    }

    return {
      label: 'Not due yet',
      className:
        'bg-emerald-500/10 text-emerald-200 border border-emerald-500/30',
    };
  };

  const handlePayWithCard = async () => {
    setPaying(true);
    setError(null);

    try {
      if (!tenant || !property || !property.monthly_rent) {
        setError('Missing rent or property information.');
        setPaying(false);
        return;
      }

      const amount = property.monthly_rent;
      const description =
        (property.name || 'Rent') +
        (property.unit_label ? ` - Unit ${property.unit_label}` : '');

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          description,
          tenantId: tenant.id,
          propertyId: property.id,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create checkout session.');
      }

      if (data.url) {
        window.location.href = data.url as string;
      } else {
        setError('No checkout URL returned from server.');
        setPaying(false);
      }
    } catch (err: any) {
      console.error('Error starting payment:', err);
      setError(err.message || 'Something went wrong starting payment.');
      setPaying(false);
    }
  };

  const dueStatus = getDueStatus(property?.next_due_date ?? null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-10">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.18em]">
              TENANT PORTAL
            </p>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-50">
              My Rent
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              View your rent details, lease info, and payment history — and pay
              securely by card.
            </p>
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="mb-4 rounded-lg border border-rose-500/70 bg-rose-950/50 px-4 py-3 text-sm text-rose-50">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)] gap-5 md:gap-6">
          {/* Left column */}
          <div className="space-y-5">
            {/* Current rent card */}
            <section className="rounded-2xl bg-slate-950 border border-slate-800/80 shadow-[0_0_0_1px_rgba(15,23,42,0.7)] p-5 md:p-6">
              {loading ? (
                <p className="text-sm text-slate-400">
                  Loading your rent info…
                </p>
              ) : !tenant ? (
                <p className="text-sm text-rose-200">
                  We couldn&apos;t find your tenant record.
                </p>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-1">
                        CURRENT RENT
                      </p>
                      <p className="text-2xl font-semibold text-slate-50">
                        {formatAmount(property?.monthly_rent)}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Next due date:{' '}
                        <span className="text-slate-200">
                          {formatDate(property?.next_due_date)}
                        </span>
                      </p>
                    </div>
                    <div
                      className={`text-[11px] px-3 py-1.5 rounded-full font-medium ${dueStatus.className}`}
                    >
                      {dueStatus.label}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handlePayWithCard}
                    disabled={paying}
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {paying ? 'Starting payment…' : 'Pay rent securely with card'}
                  </button>

                  <p className="mt-2 text-[11px] text-slate-500 max-w-md">
                    Your payment is processed securely by Stripe. You&apos;ll see
                    RentZentro&apos;s 2.5% service fee plus any Stripe card fees
                    before confirming.
                  </p>
                </>
              )}
            </section>

            {/* Payment history */}
            <section className="rounded-2xl bg-slate-950 border border-slate-800/80 p-5 md:p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  PAYMENT HISTORY
                </p>
              </div>

              {payments.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No payments recorded yet. Once you pay through RentZentro, your
                  history will appear here.
                </p>
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
                  <table className="w-full text-xs md:text-sm">
                    <thead className="bg-slate-900/70">
                      <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Method</th>
                        <th className="px-3 py-2">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id} className="border-t border-slate-900/70">
                          <td className="px-3 py-2 text-slate-300">
                            {formatDateTime(p.paid_on)}
                          </td>
                          <td className="px-3 py-2 text-emerald-300 font-medium">
                            {formatAmount(p.amount)}
                          </td>
                          <td className="px-3 py-2 text-slate-300">
                            {p.method || '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-400 max-w-xs">
                            {p.note || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Account status */}
            <section className="rounded-2xl bg-slate-950 border border-slate-800/80 p-5 md:p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-3">
                ACCOUNT
              </p>
              {tenant ? (
                <>
                  <p className="text-sm font-semibold text-slate-50">
                    {tenant.name}
                  </p>
                  <p className="text-xs text-slate-400 mb-1">
                    {tenant.email || 'No email on file'}
                  </p>
                  <p className="text-xs text-slate-400 mb-3">
                    {tenant.phone || 'No phone on file'}
                  </p>
                  <p className="text-[11px] inline-flex px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    {tenant.status ? tenant.status.toUpperCase() : 'CURRENT'}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-400">No tenant loaded.</p>
              )}
            </section>

            {/* Lease details */}
            <section className="rounded-2xl bg-slate-950 border border-slate-800/80 p-5 md:p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-3">
                LEASE & CONTACT
              </p>
              <div className="space-y-2 text-xs text-slate-300">
                <div>
                  <p className="text-slate-500 text-[11px] mb-0.5">PROPERTY</p>
                  <p>
                    {property?.name || 'Not assigned'}
                    {property?.unit_label
                      ? ` • Unit ${property.unit_label}`
                      : ''}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-slate-500 text-[11px] mb-0.5">
                      LEASE START
                    </p>
                    <p>{formatDate(tenant?.lease_start)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-[11px] mb-0.5">
                      LEASE END
                    </p>
                    <p>{formatDate(tenant?.lease_end)}</p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-3">
                  Questions about your balance, late fees, or lease terms?
                  Contact your landlord or property manager directly.
                  RentZentro powers the payment rails only.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
