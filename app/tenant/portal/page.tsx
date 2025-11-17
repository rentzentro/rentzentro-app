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

      const { data: tRow } = await supabase
        .from('tenants')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (!tRow) {
        setError('No tenant record found.');
        setLoading(false);
        return;
      }

      const t = tRow as TenantRow;
      setTenant(t);

      if (t.property_id) {
        const { data: pRow } = await supabase
          .from('properties')
          .select('*')
          .eq('id', t.property_id)
          .maybeSingle();

        if (pRow) setProperty(pRow as PropertyRow);
      }

      const { data: payRows } = await supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', t.id)
        .order('paid_on', { ascending: false });

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
    if (!tenant) {
      setError('You must be logged in as a tenant to start a payment.');
      return;
    }

    if (!rentAmount || rentAmount <= 0) {
      setError('Rent amount not configured yet. Ask your landlord.');
      return;
    }

    setPaying(true);
    setError(null);
    setSuccessMessage(null);

    const origin = window.location.origin;

    const successUrl = `${origin}/tenant/payment-success`;
    const cancelUrl = `${origin}/tenant/payment-cancelled`;

    const description =
      property && property.name
        ? `Rent payment for ${property.name}${
            property.unit_label ? ' · ' + property.unit_label : ''
          }`
        : 'Rent payment';

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: rentAmount,
          successUrl,
          cancelUrl,
          tenantId: tenant.id,
          propertyId: property?.id ?? null,
          description,
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

  // ---------- Manual mark paid ----------
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

      const { data: inserted } = await supabase
        .from('payments')
        .insert({
          tenant_id: tenant.id,
          property_id: property?.id ?? null,
          amount: rentAmount,
          paid_on: now,
          method: 'Recorded manually',
          note: 'Manual payment by tenant.',
        })
        .select()
        .single();

      if (inserted) setPayments((prev) => [inserted as PaymentRow, ...prev]);

      setSuccessMessage('Payment recorded manually.');
    } finally {
      setPaying(false);
    }
  };

  // ---------- Sign out ----------
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/tenant/login');
  };

  // ---------- UI ----------
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 p-6">
        Loading tenant portal…
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 p-6">
        No tenant found.
      </div>
    );
  }

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
            <h1 className="text-xl font-semibold mt-1">Tenant portal</h1>
          </div>

          <button
            onClick={handleSignOut}
            className="text-xs px-4 py-2 border border-slate-700 rounded-full hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>

        {(error || successMessage) && (
          <div className="mb-4 space-y-2 text-sm">
            {error && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-100">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-100">
                {successMessage}
              </div>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-[1.6fr_1.3fr] gap-4">
          {/* LEFT SIDE */}
          <div className="space-y-4">
            {/* Rent card */}
            <section className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <p className="text-xs text-slate-500 uppercase">Current rent</p>
              <p className="text-3xl font-semibold mt-1">
                {formatCurrency(rentAmount)}
              </p>
              <p className="text-xs mt-1 text-slate-400">
                Next due: <span className="text-slate-200">{nextDueLabel}</span>
              </p>

              <div className="mt-4 space-y-2">
                <button
                  disabled={paying || !rentAmount}
                  onClick={handlePayWithCard}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-2 rounded-xl"
                >
                  {paying ? 'Redirecting…' : 'Pay rent securely with card'}
                </button>
                <p className="mt-2 text-[11px] text-slate-400">
  Card payments are processed by Stripe. Your landlord uses RentZentro,
  which charges a <span className="text-slate-200 font-medium">2.5% platform fee</span>{' '}
  to the landlord for each successful card payment.
</p>

                <button
                  disabled={paying || !rentAmount}
                  onClick={handleMarkPaid}
                  className="w-full border border-emerald-400 text-emerald-200 py-2 rounded-xl"
                >
                  Mark as paid (manual)
                </button>
              </div>
            </section>

            {/* Payment history */}
            <section className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <p className="text-xs text-slate-500 uppercase">
                Payment history
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
                      className="flex justify-between items-center bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs"
                    >
                      <div>
                        <p className="font-medium text-slate-100">
                          {formatCurrency(p.amount)}
                        </p>
                        <p className="text-slate-400 text-[11px]">
                          {formatDate(p.paid_on)}
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {p.method || 'Method not specified'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* RIGHT SIDE */}
          <div className="space-y-4">
            {/* Account status */}
            <section className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <p className="text-xs text-slate-500 uppercase">Account status</p>

              <div className="mt-2 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">{tenant.name}</p>
                  <p className="text-xs text-slate-400">{tenant.email}</p>
                </div>

                <span
                  className={`text-xs px-3 py-1 rounded-full font-medium ${statusBadge}`}
                >
                  {tenant.status}
                </span>
              </div>
            </section>

            {/* Lease details */}
            <section className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <p className="text-xs text-slate-500 uppercase">Lease details</p>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500 uppercase">
                    Lease start
                  </p>
                  <p className="mt-1">{formatDate(tenant.lease_start)}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500 uppercase">
                    Lease end
                  </p>
                  <p className="mt-1">{formatDate(tenant.lease_end)}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500 uppercase">
                    Property
                  </p>
                  <p className="mt-1">
                    {property?.name}
                    {property?.unit_label ? ` · ${property.unit_label}` : ''}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500 uppercase">Phone</p>
                  <p className="mt-1">{tenant.phone || 'Not provided'}</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
