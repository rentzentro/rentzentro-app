'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

type PropertyRow = {
  id: number;
  created_at: string | null;
  name: string | null;
  unit_label: string | null;
  monthly_rent: number | null;
  status: string | null;
  next_due_date: string | null;
  owner_id: string | null;
  landlord_email: string | null;
};

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

export default function LandlordPropertiesPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [unitLabel, setUnitLabel] = useState('');
  const [monthlyRent, setMonthlyRent] = useState<string>('');
  const [status, setStatus] = useState('Current');
  const [nextDueDate, setNextDueDate] = useState('');

  // -------- Load user + data --------

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError) throw authError;
        const user = authData.user;
        if (!user) {
          router.push('/landlord/login');
          return;
        }
        setUserId(user.id);
        setUserEmail(user.email ?? null);

        const { data, error: propsError } = await supabase
          .from('properties')
          .select('*')
          .order('created_at', { ascending: false });

        if (propsError) throw propsError;

        setProperties((data || []) as PropertyRow[]);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ||
            'Failed to load properties. Please refresh and try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setUnitLabel('');
    setMonthlyRent('');
    setStatus('Current');
    setNextDueDate('');
  };

  const beginEdit = (p: PropertyRow) => {
    setEditingId(p.id);
    setName(p.name || '');
    setUnitLabel(p.unit_label || '');
    setMonthlyRent(p.monthly_rent != null ? String(p.monthly_rent) : '');
    setStatus(p.status || 'Current');
    setNextDueDate(p.next_due_date || '');
    setError(null);
    setSuccess(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this property? This cannot be undone.')) return;
    setError(null);
    setSuccess(null);
    try {
      const { error: delError } = await supabase
        .from('properties')
        .delete()
        .eq('id', id);

      if (delError) throw delError;

      setProperties((prev) => prev.filter((p) => p.id !== id));
      if (editingId === id) resetForm();
      setSuccess('Property deleted.');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to delete property.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setError('Not logged in.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: Partial<PropertyRow> = {
        name: name.trim() || null,
        unit_label: unitLabel.trim() || null,
        monthly_rent: monthlyRent ? Number(monthlyRent) : null,
        status: status.trim() || null,
        next_due_date: nextDueDate || null,
      };

      if (editingId == null) {
        const { data, error: insertError } = await supabase
          .from('properties')
          .insert([
            {
              ...payload,
              owner_id: userId,
              landlord_email: userEmail,
            },
          ])
          .select('*')
          .single();

        if (insertError) throw insertError;

        setProperties((prev) => [data as PropertyRow, ...prev]);
        resetForm();
        setSuccess('Property created.');
      } else {
        const { data, error: updateError } = await supabase
          .from('properties')
          .update(payload)
          .eq('id', editingId)
          .select('*')
          .single();

        if (updateError) throw updateError;

        setProperties((prev) =>
          prev.map((p) => (p.id === editingId ? (data as PropertyRow) : p))
        );
        resetForm();
        setSuccess('Property updated.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to save property.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/landlord/login');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading properties…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs text-slate-500 flex gap-2">
              <Link href="/landlord" className="hover:text-emerald-400">
                Landlord
              </Link>
              <span>/</span>
              <span className="text-slate-300">Properties</span>
            </div>
            <h1 className="mt-1 text-xl font-semibold text-slate-50">
              Properties
            </h1>
            <p className="text-[13px] text-slate-400">
              Track each unit, its status, and rent.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <Link
              href="/landlord"
              className="text-xs px-3 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
            >
              Back to dashboard
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs px-3 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        </div>

        {(error || success) && (
          <div
            className={`mb-4 rounded-2xl border px-4 py-2 text-sm ${
              error
                ? 'border-rose-500/60 bg-rose-950/40 text-rose-100'
                : 'border-emerald-500/60 bg-emerald-950/40 text-emerald-100'
            }`}
          >
            {error || success}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)]">
          {/* List */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  Your units
                </p>
                <p className="mt-1 text-sm font-medium text-slate-50">
                  {properties.length} record
                  {properties.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            {properties.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500">
                No properties yet. Use the form on the right to add your first
                unit.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {properties.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="font-medium text-slate-100">
                        {p.name || 'Untitled property'}
                        {p.unit_label ? ` · ${p.unit_label}` : ''}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Rent {formatCurrency(p.monthly_rent)} •{' '}
                        {p.status || 'Status unknown'}
                      </p>
                      {p.next_due_date && (
                        <p className="text-[11px] text-slate-500">
                          Next due {formatDate(p.next_due_date)}
                        </p>
                      )}
                    </div>

                    {/* BUTTONS — updated to blue EDIT */}
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => beginEdit(p)}
                        className="rounded-full border border-sky-500/70 bg-sky-500/10 px-3 py-1 text-[11px] text-sky-200 hover:bg-sky-500/20"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        className="rounded-full border border-rose-500/70 bg-rose-500/10 px-3 py-1 text-[11px] text-rose-200 hover:bg-rose-500/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Form */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
              {editingId ? 'Edit property' : 'Add property'}
            </p>
            <p className="text-[13px] text-slate-400 mb-4">
              {editingId
                ? 'Update unit details and rent.'
                : 'Add each unit you manage so RentZentro can track rent and status.'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block text-slate-300">Property name</label>
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 123 Main St"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-300">Unit / label</label>
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                  value={unitLabel}
                  onChange={(e) => setUnitLabel(e.target.value)}
                  placeholder="e.g. Apt 2B"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-300">Monthly rent</label>
                  <input
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(e.target.value)}
                    placeholder="e.g. 1500"
                    inputMode="numeric"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-300">Status</label>
                  <select
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option>Current</option>
                    <option>Vacant</option>
                    <option>Future</option>
                    <option>Inactive</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-300">Next due date</label>
                <input
                  type="date"
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {saving
                    ? editingId
                      ? 'Saving…'
                      : 'Creating…'
                    : editingId
                    ? 'Save changes'
                    : 'Create property'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    Cancel editing
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
