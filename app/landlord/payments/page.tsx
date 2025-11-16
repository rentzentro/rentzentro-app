'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

type Payment = {
  id: number;
  tenant_id: number | null;
  property_id: number | null;
  amount: number | null;
  paid_on: string | null;
  method: string | null;
  note: string | null;
};

type Tenant = {
  id: number;
  name: string | null;
  email: string;
};

type Property = {
  id: number;
  name: string | null;
  unit_label: string | null;
};

type FormState = {
  tenantId: string;
  propertyId: string;
  amount: string;
  paidOn: string;
  method: string;
  note: string;
};

const emptyForm: FormState = {
  tenantId: '',
  propertyId: '',
  amount: '',
  paidOn: '',
  method: 'Manual entry',
  note: '',
};

export default function LandlordPaymentsPage() {
  const router = useRouter();

  const [authChecking, setAuthChecking] = useState(true);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);

  const [form, setForm] = useState<FormState>({
    ...emptyForm,
    paidOn: new Date().toISOString().split('T')[0],
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -------- AUTH CHECK --------
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error('Payments auth error:', error);
        setError('Problem checking your session. Please log in again.');
        setAuthChecking(false);
        return;
      }

      if (!session) {
        router.replace('/landlord/login');
        return;
      }

      setAuthChecking(false);
    };

    checkAuth();
  }, [router]);

  // -------- LOAD DATA --------
  useEffect(() => {
    if (authChecking) return;

    const load = async () => {
      setLoading(true);
      setError(null);

      // Tenants
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('id, name, email')
        .order('created_at', { ascending: false });

      if (tenantError) {
        console.error('Payments tenants error:', tenantError);
      } else {
        setTenants((tenantData as Tenant[]) || []);
      }

      // Properties
      const { data: propsData, error: propsError } = await supabase
        .from('properties')
        .select('id, name, unit_label')
        .order('created_at', { ascending: false });

      if (propsError) {
        console.error('Payments properties error:', propsError);
      } else {
        setProperties((propsData as Property[]) || []);
      }

      // Payments
      const { data: payData, error: payError } = await supabase
        .from('payments')
        .select('*')
        .order('paid_on', { ascending: false });

      if (payError) {
        console.error('Payments load error:', payError);
        setError('Error loading payments.');
      } else {
        setPayments((payData as Payment[]) || []);
      }

      setLoading(false);
    };

    load();
  }, [authChecking]);

  // -------- HELPERS --------
  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm({
      ...emptyForm,
      paidOn: new Date().toISOString().split('T')[0],
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (!form.amount) {
      setError('Amount is required.');
      setSaving(false);
      return;
    }

    const payload = {
      tenant_id: form.tenantId ? Number(form.tenantId) : null,
      property_id: form.propertyId ? Number(form.propertyId) : null,
      amount: Number(form.amount),
      paid_on: form.paidOn || null,
      method: form.method || 'Manual entry',
      note: form.note.trim() || null,
    };

    try {
      const { data, error } = await supabase
        .from('payments')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setPayments((prev) => [data as Payment, ...prev]);
      }

      resetForm();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error recording payment.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this payment record?')) return;

    const { error } = await supabase.from('payments').delete().eq('id', id);

    if (error) {
      console.error(error);
      setError('Error deleting payment.');
      return;
    }

    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/landlord/login');
  };

  const formatCurrency = (val: number | null) =>
    val == null
      ? '—'
      : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }).format(val);

  const formatDate = (val: string | null) => {
    if (!val) return '—';
    try {
      return new Date(val).toLocaleDateString();
    } catch {
      return val;
    }
  };

  const tenantLabel = (id: number | null) => {
    if (!id) return 'Unassigned';
    const t = tenants.find((t) => t.id === id);
    if (!t) return `Tenant #${id}`;
    return t.name || t.email;
  };

  const propertyLabel = (id: number | null) => {
    if (!id) return 'Unassigned';
    const p = properties.find((p) => p.id === id);
    if (!p) return `Property #${id}`;
    return `${p.name || 'Property'}${p.unit_label ? ` · ${p.unit_label}` : ''}`;
  };

  if (authChecking) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Checking authentication…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Top Nav */}
        <header className="border-b border-slate-800 pb-4 mb-4">
          <nav className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Brand */}
            <Link href="/landlord" className="inline-flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-[11px] font-bold text-emerald-300">
                RZ
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold text-slate-50">
                  RentZentro
                </span>
                <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  Landlord Console
                </span>
              </div>
            </Link>

            {/* Nav – Dashboard, Tenants, Logout (no Payments pill here) */}
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
              <Link
                href="/landlord"
                className="rounded-full border border-slate-700 px-3 py-1.5 hover:bg-slate-900 text-slate-200"
              >
                Dashboard
              </Link>

              <Link
                href="/landlord/tenants"
                className="rounded-full border border-slate-700 px-3 py-1.5 hover:bg-slate-900 text-slate-200"
              >
                Tenants
              </Link>

              <button
                onClick={handleLogout}
                className="rounded-full border border-slate-700 px-3 py-1.5 hover:bg-slate-900 text-slate-200"
              >
                Log out
              </button>
            </div>
          </nav>

          <div className="mt-4">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Payments
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              View and manually record rent payments. Tenant portal payments
              will also appear here in the future.
            </p>
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="rounded-xl border border-rose-800/70 bg-rose-950/70 p-3 text-xs text-rose-100">
            {error}
          </div>
        )}

        {/* Layout: form + list */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
          {/* Add payment form */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-100">
              Record a payment
            </h2>
            <p className="text-xs text-slate-400">
              Use this for manual payments like cash, check, or adjustments.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3 text-sm">
              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  Tenant (optional)
                </label>
                <select
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  value={form.tenantId}
                  onChange={(e) => handleChange('tenantId', e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name || t.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  Property (optional)
                </label>
                <select
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  value={form.propertyId}
                  onChange={(e) => handleChange('propertyId', e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || 'Property'}
                      {p.unit_label ? ` · ${p.unit_label}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">
                    Amount (USD)
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    value={form.amount}
                    onChange={(e) => handleChange('amount', e.target.value)}
                    placeholder="1500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 block mb-1">
                    Paid on
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    value={form.paidOn}
                    onChange={(e) => handleChange('paidOn', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  Method
                </label>
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  value={form.method}
                  onChange={(e) => handleChange('method', e.target.value)}
                  placeholder="Cash, check, portal, etc."
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  Note (optional)
                </label>
                <textarea
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  rows={3}
                  value={form.note}
                  onChange={(e) => handleChange('note', e.target.value)}
                  placeholder="Late fee, partial payment, corrections, etc."
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Record payment'}
              </button>
            </form>
          </div>

          {/* Payments list */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">
                All payments
              </h2>
              <p className="text-xs text-slate-500">
                {payments.length === 0
                  ? 'No payments yet.'
                  : `${payments.length} total`}
              </p>
            </div>

            {loading ? (
              <p className="text-xs text-slate-400">Loading payments…</p>
            ) : payments.length === 0 ? (
              <p className="text-xs text-slate-400">
                Once payments are recorded, they will appear here.
              </p>
            ) : (
              <ul className="space-y-2 text-xs">
                {payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-100">
                          {formatCurrency(p.amount)}
                        </p>
                        <p className="text-slate-400">
                          Tenant: {tenantLabel(p.tenant_id)}
                        </p>
                        <p className="text-slate-400">
                          Property: {propertyLabel(p.property_id)}
                        </p>
                      </div>
                      <div className="text-right text-[11px] text-slate-500">
                        <p>Paid on</p>
                        <p className="text-slate-300">
                          {formatDate(p.paid_on)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-slate-500">
                        Method: {p.method || 'Rent'}
                        {p.note && ` · ${p.note}`}
                      </p>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-[11px] text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

