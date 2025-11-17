'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

// ------------------------
// Types
// ------------------------

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

// ------------------------
// Helpers
// ------------------------

const formatCurrency = (v: number | null | undefined) =>
  v == null ? '-' : v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

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

// ------------------------
// Component
// ------------------------

export default function TenantPortalPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [property, setProperty] = useState<PropertyRow | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  // ------------------------
  // Load tenant details
  // ------------------------

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session?.user) {
        router.push('/tenant/login');
        return;
      }

      const email = session.user.email?.toLowerCase().trim();
      if (!email) return;

      const { data: tRow } = await supabase
        .from('tenants')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (!tRow) {
        setError('Tenant not found.');
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

      const { data: pRows } = await supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', t.id)
        .order('paid_on', { ascending: false });

      if (pRows) setPayments(pRows as PaymentRow[]);

      setLoading(false);
    };

    load();
  }, [router]);

  const rentAmount =
    tenant?.monthly_rent ?? property?.monthly_rent ?? null;

  // ------------------------
  // Stripe Checkout
  // ------------------------

  const handlePayWithCard = async () => {
    if (!rentAmount || rentAmount <= 0) {
      setError('Rent amount not configured.');
      return;
    }

    setPaying(true);
    setError(null);

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

      if (!res.ok || !data.url) throw new Error(data.error || 'Payment failed.');
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message || 'Unexpected error.');
    } finally {
      setPaying(false);
    }
  };

  // ------------------------
  // UI
  // ------------------------

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="text-sm text-slate-500 flex gap-2">
              <Link href="/tenant" className="hover:text-emerald-400">
                Tenant
              </Link>
              <span>/</span>
              <span className="text-slate-300">Portal</span>
            </div>
            <h1 className="text-xl font-semibold mt-1">Tenant portal</h1>
          </div>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/tenant/login');
            }}
            className="text-xs px-4 py-2 border border-slate-700 rounded-full hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 text-sm p-3 rounded-xl bg-rose-900/40 border border-rose-600/40">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {/* Rent Card */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <p className="text-xs text-slate-500 uppercase">Current rent</p>
            <p className="text-3xl font-semibold mt-1">{formatCurrency(rentAmount)}</p>

            <button
              disabled={paying}
              onClick={handlePayWithCard}
              className="mt-4 w-full rounded-xl bg-emerald-500 text-slate-950 font-semibold py-2 hover:bg-emerald-400"
            >
              {paying ? 'Redirecting…' : 'Pay rent securely with card'}
            </button>
          </div>

          {/* Account Card */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <p className="text-xs text-slate-500 uppercase">Account status</p>
            <p className="text-lg mt-1 font-medium">{tenant.name}</p>
            <p className="text-xs text-slate-400">{tenant.email}</p>
          </div>
        </div>

        {/* Payment History */}
        <div className="mt-6 p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-xs text-slate-500 uppercase">Payment history</p>

          {payments.length === 0 ? (
            <p className="mt-4 text-xs text-slate-500">No payments recorded.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-xl border border-slate-800 bg-slate-950 text-sm flex justify-between"
                >
                  <span>{formatCurrency(p.amount)}</span>
                  <span className="text-slate-400">{formatDate(p.paid_on)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
