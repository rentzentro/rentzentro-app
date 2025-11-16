'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

type Tenant = {
  id: number;
  name: string | null;
  email: string;
  monthly_rent: number | null;
};

type Payment = {
  id: number;
  created_at: string;
  tenant_id: number | null;
  property_id: number | null;
  amount: number | null;
  paid_on: string | null;
  method: string | null;
  note: string | null;
  tenant?: Tenant;
};

export default function LandlordPaymentsPage() {
  const router = useRouter();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState('');
  const [method, setMethod] = useState('Rent');
  const [note, setNote] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load tenants + recent payments
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const [{ data: tenantsData, error: tenantsError }, { data: paymentsData, error: paymentsError }] =
        await Promise.all([
          supabase
            .from('tenants')
            .select('id, name, email, monthly_rent')
            .order('name', { ascending: true }),
          supabase
            .from('payments')
            .select('*')
            .order('paid_on', { ascending: false })
            .limit(20),
        ]);

      if (tenantsError) {
        console.error(tenantsError);
        setError('Error loading tenants.');
      } else {
        setTenants(tenantsData || []);
      }

      if (paymentsError) {
        console.error(paymentsError);
        setError('Error loading payments.');
      } else {
        setPayments(paymentsData || []);
      }

      setLoading(false);
    };

    load();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedTenantId) {
      setError('Please select a tenant.');
      return;
    }
    if (!amount) {
      setError('Please enter an amount.');
      return;
    }

    setSaving(true);

    const tenantIdNum = Number(selectedTenantId);
    const tenant = tenants.find((t) => t.id === tenantIdNum);

    const payload = {
      tenant_id: tenantIdNum,
      property_id: null, // we could wire this later if you tie tenants to properties
      amount: Number(amount),
      paid_on: paidOn || new Date().toISOString().slice(0, 10),
      method: method.trim() || 'Rent',
      note: note.trim() || null,
    };

    const { error: insertError } = await supabase.from('payments').insert(payload);

    if (insertError) {
      console.error(insertError);
      setError(insertError.message || 'Error recording payment.');
      setSaving(false);
      return;
    }

    // Reload payments list
    const { data: paymentsData, error: reloadError } = await supabase
      .from('payments')
      .select('*')
      .order('paid_on', { ascending: false })
      .limit(20);

    if (!reloadError && paymentsData) {
      setPayments(paymentsData);
    }

    // Reset form
    setSaving(false);
    setAmount('');
    setPaidOn('');
    setMethod('Rent');
    setNote('');
  };

  const formatCurrency = (val: number | null) => {
    if (val == null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (val: string | null) => {
    if (!val) return '—';
    try {
      return new Date(val).toLocaleDateString();
    } catch {
      return val;
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Payments</h1>
            <p className="mt-1 text-sm text-slate-400">
              Record manual rent payments and review recent history.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/landlord"
              className="rounded-full border border-slate-700 px-4 py-2 text-xs hover:bg-slate-900"
            >
              Back to dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-full border border-slate-700 px-4 py-2 text-xs hover:bg-slate-900"
            >
              Log out
            </button>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-900/40 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {/* Form + list */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)]">
          {/* Form */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-100">
              Record a payment
            </h2>
            <p className="text-xs text-slate-400">
              This is for manual entry (cash, check, Zelle, etc.). Stripe payments will
              automatically appear here in the future.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Tenant
                </label>
                <select
                  value={selectedTenantId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedTenantId(val);

                    // auto-fill amount with tenant monthly rent if empty
                    if (val) {
                      const t = tenants.find((tt) => tt.id === Number(val));
                      if (t?.monthly_rent && !amount) {
                        setAmount(String(t.monthly_rent));
                      }
                    }
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="">Select tenant</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name || '(no name)'} – {t.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    placeholder="1500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Paid on
                  </label>
                  <input
                    type="date"
                    value={paidOn}
                    onChange={(e) => setPaidOn(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Method
                  </label>
                  <input
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    placeholder="Cash / Check / Zelle / etc."
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Note (optional)
                  </label>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    placeholder="e.g. Partial payment, late fee, etc."
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {saving ? 'Saving payment…' : 'Save payment'}
              </button>
            </form>
          </section>

          {/* Recent payments */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="text-sm font-semibold text-slate-100">
              Recent payments
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              The 20 most recent payments, across all tenants.
            </p>

            {loading ? (
              <p className="mt-4 text-xs text-slate-400">Loading…</p>
            ) : payments.length === 0 ? (
              <p className="mt-4 text-xs text-slate-400">
                No payments recorded yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-3 text-sm">
                {payments.map((p) => {
                  const tenant = tenants.find((t) => t.id === p.tenant_id);
                  return (
                    <li
                      key={p.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">
                          {tenant?.name || '(no name)'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {tenant?.email || 'Unknown email'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(p.paid_on)} · {p.method || 'Rent'}
                        </p>
                        {p.note && (
                          <p className="text-[11px] text-slate-500">
                            Note: {p.note}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {formatCurrency(p.amount)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
