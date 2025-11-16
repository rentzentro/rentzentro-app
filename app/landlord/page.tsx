'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabaseClient';

type Property = {
  id: number;
  created_at: string;
  name: string;
  unit_label: string | null;
  monthly_rent: number | null;
  status: string | null;
  next_due_date: string | null;
};

type FormState = {
  name: string;
  unitLabel: string;
  monthlyRent: string;
  status: 'current' | 'vacant';
  nextDueDate: string;
};

const emptyForm: FormState = {
  name: '',
  unitLabel: '',
  monthlyRent: '',
  status: 'current',
  nextDueDate: '',
};

export default function LandlordPage() {
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [authChecking, setAuthChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------- AUTH + LOAD PROPERTIES ----------
  useEffect(() => {
    const checkAuthAndLoad = async () => {
      setAuthChecking(true);

      // 1) Check if landlord is logged in
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Landlord dashboard – session error:', sessionError);
        setError('Problem checking your login. Please try again.');
        setAuthChecking(false);
        return;
      }

      if (!session) {
        // Not logged in → go to landlord login
        router.push('/landlord/login');
        return;
      }

      // 2) Load properties
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from<Property>('properties')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        setError('Error loading properties.');
      } else if (data) {
        setProperties(data);
      }

      setLoading(false);
      setAuthChecking(false);
    };

    checkAuthAndLoad();
  }, [router]);

  // ---------- STATS ----------
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      unit_label: form.unitLabel.trim() || null,
      monthly_rent: form.monthlyRent ? Number(form.monthlyRent) : null,
      status: form.status,
      next_due_date: form.nextDueDate || null,
    };

    try {
      if (editingId) {
        const { data, error } = await supabase
          .from<Property>('properties')
          .update(payload)
          .eq('id', editingId)
          .select()
          .single();

        if (error) throw error;

        setProperties((prev) =>
          prev.map((p) => (p.id === editingId ? (data as Property) : p))
        );
      } else {
        const { data, error } = await supabase
          .from<Property>('properties')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        setProperties((prev) => [data as Property, ...prev]);
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

  // While checking auth, show nothing (or a tiny message)
  if (authChecking) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Checking your session…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold">
              Landlord Dashboard{' '}
              <span className="text-xs text-emerald-400">(beta)</span>
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Track properties and monthly rent in one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/landlord/tenants"
              className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
            >
              Manage tenants
            </Link>
            <Link
              href="/landlord/payments"
              className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
            >
              Payments
            </Link>
            <Link
              href="/"
              className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
            >
              Back to home
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        </header>

        {/* Stats */}
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400">PROPERTIES</p>
            <p className="mt-2 text-2xl font-semibold">{totalProperties}</p>
            <p className="mt-1 text-xs text-slate-500">
              Units under your account.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400">MONTHLY RENT TOTAL</p>
            <p className="mt-2 text-2xl font-semibold">
              ${totalMonthlyRent.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-slate-500">Across all properties.</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400">CURRENT VS VACANT</p>
            <p className="mt-2 text-lg font-semibold">
              <span className="text-emerald-400">{currentCount} current</span>{' '}
              · <span className="text-amber-300">{vacantCount} vacant</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Based on the status field below.
            </p>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Form + list */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.1fr)] items-start">
          {/* Form */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-200">
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
              <div className="space-y-1">
                <label className="text-xs text-slate-300">Property name</label>
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="123 Main St"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300">Unit / label</label>
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  value={form.unitLabel}
                  onChange={(e) => handleChange('unitLabel', e.target.value)}
                  placeholder="Unit 1A"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300">
                  Monthly rent (USD)
                </label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  value={form.monthlyRent}
                  onChange={(e) => handleChange('monthlyRent', e.target.value)}
                  placeholder="1500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300">Status</label>
                <select
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  value={form.status}
                  onChange={(e) =>
                    handleChange('status', e.target.value as FormState['status'])
                  }
                >
                  <option value="current">Current</option>
                  <option value="vacant">Vacant</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300">
                  Next rent due date
                </label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  value={form.nextDueDate}
                  onChange={(e) => handleChange('nextDueDate', e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {saving
                  ? editingId
                    ? 'Saving changes...'
                    : 'Saving...'
                  : editingId
                  ? 'Save changes'
                  : 'Save property'}
              </button>
            </form>
          </section>

          {/* Properties list */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-200">
              Your properties
            </h2>

            {loading ? (
              <p className="text-xs text-slate-400">Loading properties…</p>
            ) : properties.length === 0 ? (
              <p className="text-xs text-slate-400">
                No properties yet. Add your first one on the left.
              </p>
            ) : (
              <ul className="space-y-3 text-sm">
                {properties.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 px-3 py-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-100">
                          {p.name}{' '}
                          {p.unit_label && (
                            <span className="text-xs text-slate-400">
                              · {p.unit_label}
                            </span>
                          )}
                        </p>
                      </div>
                      <p className="text-xs text-slate-400">
                        Rent:{' '}
                        {p.monthly_rent
                          ? `$${p.monthly_rent.toLocaleString()}`
                          : '—'}
                      </p>
                      <p className="text-xs text-slate-400">
                        Status:{' '}
                        <span
                          className={
                            (p.status || '').toLowerCase() === 'current'
                              ? 'text-emerald-400'
                              : 'text-amber-300'
                          }
                        >
                          {p.status || 'unknown'}
                        </span>
                      </p>
                      {p.next_due_date && (
                        <p className="text-xs text-slate-400">
                          Next due:{' '}
                          {new Date(p.next_due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <button
                        onClick={() => handleEdit(p)}
                        className="text-xs text-slate-300 hover:text-emerald-400"
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
          </section>
        </div>
      </div>
    </main>
  );
}
