'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabaseClient';

type Property = {
  id: number;
  created_at: string;
  name: string | null;
  unit_label: string | null;
  monthly_rent: number | null;
  status: string | null;
  next_due_date: string | null;
};

type Payment = {
  id: number;
  tenant_id: number | null;
  property_id: number | null;
  amount: number | null;
  paid_on: string | null;
  method: string | null;
  note: string | null;
  created_at?: string;
};

type FormState = {
  name: string;
  unitLabel: string;
  monthlyRent: string;
  status: 'current' | 'vacant' | 'notice';
  nextDueDate: string;
};

const emptyForm: FormState = {
  name: '',
  unitLabel: '',
  monthlyRent: '',
  status: 'current',
  nextDueDate: '',
};

export default function LandlordDashboardPage() {
  const router = useRouter();

  const [authChecking, setAuthChecking] = useState(true);

  const [properties, setProperties] = useState<Property[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [loadingData, setLoadingData] = useState(false);
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
        console.error('Landlord dashboard auth error:', error);
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

  // -------- LOAD DATA (properties + recent payments) --------
  useEffect(() => {
    if (authChecking) return;

    const loadData = async () => {
      setLoadingData(true);
      setError(null);

      // Load properties
      const { data: propsData, error: propsError } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

      if (propsError) {
        console.error('Error loading properties:', propsError);
        setError('Error loading properties.');
      } else if (propsData) {
        setProperties(propsData as Property[]);
      }

      // Load recent payments (same table/columns as Payments page, but limited)
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .order('paid_on', { ascending: false })
        .limit(5);

      if (paymentsError) {
        console.error('Error loading recent payments:', paymentsError);
      } else if (paymentsData) {
        setPayments(paymentsData as Payment[]);
      }

      setLoadingData(false);
    };

    loadData();
  }, [authChecking]);

  // -------- STATS --------
  const totalProperties = properties.length;
  const totalMonthlyRent = properties.reduce(
    (sum, p) => sum + (p.monthly_rent || 0),
    0
  );
  const currentCount = properties.filter(
    (p) => (p.status || '').toLowerCase() === 'current'
  ).length;
  const vacantCount = properties.filter(
    (p) => (p.status || '').toLowerCase() === 'vacant'
  ).length;

  const collectedAllTime = payments.reduce(
    (sum, p) => sum + (p.amount || 0),
    0
  );

  // -------- HELPERS --------
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

  const handleChange = (
    field: keyof FormState,
    value: string | FormState['status']
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  // -------- SAVE PROPERTY (ADD / EDIT) --------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim() || null,
      unit_label: form.unitLabel.trim() || null,
      monthly_rent: form.monthlyRent ? Number(form.monthlyRent) : null,
      status: form.status,
      next_due_date: form.nextDueDate || null,
    };

    try {
      if (editingId) {
        const { data, error } = await supabase
          .from('properties')
          .update(payload)
          .eq('id', editingId)
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setProperties((prev) =>
            prev.map((p) => (p.id === editingId ? (data as Property) : p))
          );
        }
      } else {
        const { data, error } = await supabase
          .from('properties')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setProperties((prev) => [data as Property, ...prev]);
        }
      }

      resetForm();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error saving property.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (property: Property) => {
    setEditingId(property.id);
    setForm({
      name: property.name || '',
      unitLabel: property.unit_label || '',
      monthlyRent: property.monthly_rent?.toString() || '',
      status:
        (property.status?.toLowerCase() as FormState['status']) || 'current',
      nextDueDate: property.next_due_date || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this property?')) return;

    const { error } = await supabase.from('properties').delete().eq('id', id);

    if (error) {
      console.error(error);
      setError('Error deleting property.');
      return;
    }

    setProperties((prev) => prev.filter((p) => p.id !== id));

    if (editingId === id) {
      resetForm();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/landlord/login');
  };

  if (authChecking) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Checking your session…</p>
      </main>
    );
  }

  // -------- UI --------
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Landlord Dashboard{' '}
              <span className="text-xs text-emerald-400 align-middle">
                beta
              </span>
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Track properties, tenants, and rent payments in one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/landlord/tenants"
              className="rounded-full border border-slate-700 px-4 py-2 text-xs sm:text-sm hover:bg-slate-900"
            >
              Manage tenants
            </Link>
            <Link
              href="/landlord/payments"
              className="rounded-full border border-slate-700 px-4 py-2 text-xs sm:text-sm hover:bg-slate-900"
            >
              View all payments
            </Link>
            <Link
              href="/"
              className="rounded-full border border-slate-700 px-4 py-2 text-xs sm:text-sm hover:bg-slate-900"
            >
              Back to home
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-full border border-slate-700 px-4 py-2 text-xs sm:text-sm hover:bg-slate-900"
            >
              Log out
            </button>
          </div>
        </header>

        {/* Stats */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">
              Properties
            </p>
            <p className="mt-2 text-2xl font-semibold">{totalProperties}</p>
            <p className="mt-1 text-xs text-slate-500">
              Units under your account.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">
              Monthly rent total
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {formatCurrency(totalMonthlyRent)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Across all current properties.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">
              Current vs vacant
            </p>
            <p className="mt-2 text-xl font-semibold">
              <span className="text-emerald-400">{currentCount} current</span>{' '}
              · <span className="text-amber-300">{vacantCount} vacant</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Based on property status field.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">
              Collected (recent sample)
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {formatCurrency(collectedAllTime)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Sum of amounts from the last few payments.
            </p>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {/* Main layout: properties + recent payments */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {/* Properties: form + list */}
          <div className="space-y-4">
            {/* Form */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-100">
                  {editingId ? `Edit property #${editingId}` : 'Add a property'}
                </h2>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Cancel edit
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">
                    Property name
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="123 Main St"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">
                    Unit / label
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    value={form.unitLabel}
                    onChange={(e) => handleChange('unitLabel', e.target.value)}
                    placeholder="Unit 1A"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-300 block mb-1">
                      Monthly rent (USD)
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                      value={form.monthlyRent}
                      onChange={(e) =>
                        handleChange('monthlyRent', e.target.value)
                      }
                      placeholder="1500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1">
                      Status
                    </label>
                    <select
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                      value={form.status}
                      onChange={(e) =>
                        handleChange(
                          'status',
                          e.target.value as FormState['status']
                        )
                      }
                    >
                      <option value="current">Current</option>
                      <option value="vacant">Vacant</option>
                      <option value="notice">Notice</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">
                    Next rent due date
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    value={form.nextDueDate}
                    onChange={(e) =>
                      handleChange('nextDueDate', e.target.value)
                    }
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {saving
                    ? editingId
                      ? 'Saving changes…'
                      : 'Saving…'
                    : editingId
                    ? 'Save changes'
                    : 'Save property'}
                </button>
              </form>
            </div>

            {/* Property list */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-100">
                  Your properties
                </h2>
                <p className="text-xs text-slate-500">
                  {totalProperties === 0
                    ? 'No properties yet.'
                    : `${totalProperties} total`}
                </p>
              </div>

              {loadingData ? (
                <p className="text-xs text-slate-400">
                  Loading properties…
                </p>
              ) : properties.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Add your first property using the form above.
                </p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {properties.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-3"
                    >
                      <div>
                        <p className="font-medium text-slate-100">
                          {p.name || 'Untitled property'}{' '}
                          {p.unit_label && (
                            <span className="text-xs text-slate-400">
                              · {p.unit_label}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Rent:{' '}
                          <span className="text-slate-100">
                            {formatCurrency(p.monthly_rent)}
                          </span>{' '}
                          · Status:{' '}
                          <span
                            className={
                              (p.status || '').toLowerCase() === 'current'
                                ? 'text-emerald-400'
                                : 'text-amber-300'
                            }
                          >
                            {p.status || 'unknown'}
                          </span>
                          {p.next_due_date && (
                            <>
                              {' '}
                              · Next due:{' '}
                              <span className="text-slate-200">
                                {formatDate(p.next_due_date)}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2 sm:items-center">
                        <button
                          onClick={() => handleEdit(p)}
                          className="text-xs text-slate-200 hover:text-emerald-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Recent payments */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-100">
                  Recent payments
                </h2>
                <Link
                  href="/landlord/payments"
                  className="text-xs text-emerald-300 hover:text-emerald-200"
                >
                  View all
                </Link>
              </div>

              {payments.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No payments recorded yet.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-start justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"
                    >
                      <div>
                        <p className="font-medium text-slate-100">
                          {formatCurrency(p.amount)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {p.method || 'Rent'} ·{' '}
                          {p.note ? `Note: ${p.note}` : 'No note'}
                        </p>
                      </div>
                      <div className="text-xs text-slate-500 text-right">
                        <p>Paid on</p>
                        <p className="text-slate-300">
                          {formatDate(p.paid_on)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-400">
              <p className="font-semibold text-slate-200 mb-1">
                Coming soon: direct online payments
              </p>
              <p>
                Stripe integration will allow tenants to pay directly from their
                portal. Those payments will automatically appear here and update
                rent status in real time.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
