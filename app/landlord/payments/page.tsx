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

  // AUTH CHECK
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/landlord/login');
        return;
      }

      setAuthChecking(false);
    };

    checkAuth();
  }, [router]);

  // LOAD DATA
  useEffect(() => {
    if (authChecking) return;

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data: tenantData } = await supabase
        .from('tenants')
        .select('id, name, email')
        .order('created_at', { ascending: false });

      setTenants(tenantData || []);

      const { data: propsData } = await supabase
        .from('properties')
        .select('id, name, unit_label')
        .order('created_at', { ascending: false });

      setProperties(propsData || []);

      const { data: payData, error: payError } = await supabase
        .from('payments')
        .select('*')
        .order('paid_on', { ascending: false });

      if (payError) {
        setError('Error loading payments.');
      } else {
        setPayments(payData || []);
      }

      setLoading(false);
    };

    load();
  }, [authChecking]);

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

    const { data, error } = await supabase
      .from('payments')
      .insert(payload)
      .select()
      .single();

    if (error) {
      setError(error.message);
    } else if (data) {
      setPayments((prev) => [data as Payment, ...prev]);
      resetForm();
    }

    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this payment?')) return;

    await supabase.from('payments').delete().eq('id', id);
    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/landlord/login');
  };

  if (authChecking) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Checking authentication…</p>
      </main>
    );
  }

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
    return new Date(val).toLocaleDateString();
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Top Nav */}
        <header className="border-b border-slate-800 pb-4">
          <nav className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Brand */}
            <Link href="/landlord" className="inline-flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-[11px] font-bold text-emerald-300">
                RZ
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">RentZentro</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-500">
                  Landlord Console
                </span>
              </div>
            </Link>

            {/* FIXED NAVIGATION per your instructions */}
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

              {/* ACTIVE LABEL (not a button) */}
              <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 font-medium text-slate-100">
                Payments
              </span>

              {/* Logout ONLY (no home, no extra payments) */}
              <button
                onClick={handleLogout}
                className="rounded-full border border-slate-700 px-3 py-1.5 hover:bg-slate-900 text-slate-200"
              >
                Log out
              </button>
            </div>
          </nav>

          <div className="mt-4">
            <h1 className="text-2xl font-semibold">Payments</h1>
            <p className="text-sm text-slate-400">
              View and record rent payments.
            </p>
          </div>
        </header>

        {/* Main Content */}
        <section className="grid gap-6 lg:grid-cols-[1.3fr_2fr]">
          {/* Payment Form */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
            <h2 className="text-sm font-semibold">Record a payment</h2>

            {error && (
              <div className="text-xs text-rose-300 border border-rose-800/50 bg-rose-950/40 p-2 rounded">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-sm">
              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  Amount (USD)
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.amount}
                  onChange={(e) => handleChange('amount', e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  Paid on
                </label>
                <input
                  type="date"
                  value={form.paidOn}
                  onChange={(e) => handleChange('paidOn', e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-medium px-3 py-2"
              >
                {saving ? 'Saving…' : 'Record Payment'}
              </button>
            </form>
          </div>

          {/* Payment List */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-3">
            <h2 className="text-sm font-semibold">All Payments</h2>

            {payments.length === 0 ? (
              <p className="text-xs text-slate-400">No payments yet.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {payments.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-100">
                          {formatCurrency(p.amount)}
                        </p>
                        <p className="text-slate-400 text-[11px]">
                          Paid on {formatDate(p.paid_on)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-red-400 text-[11px] hover:text-red-300"
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

