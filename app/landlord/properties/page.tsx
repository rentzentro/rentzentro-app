'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

type PropertyRow = {
  id: number;
  name: string | null;
  unit_label: string | null;
  monthly_rent: number | null;
  status: string | null;
  next_due_date: string | null;
  created_at?: string;
};

type FormState = {
  name: string;
  unitLabel: string;
  monthlyRent: string;
  status: 'current' | 'vacant' | 'notice' | 'inactive';
  nextDueDate: string;
};

const emptyForm: FormState = {
  name: '',
  unitLabel: '',
  monthlyRent: '',
  status: 'current',
  nextDueDate: '',
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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const formRef = useRef<HTMLDivElement | null>(null);

  // ---------- Load properties ----------
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: loadError } = await supabase
          .from('properties')
          .select('*')
          .order('created_at', { ascending: false });

        if (loadError) throw loadError;

        setProperties((data || []) as PropertyRow[]);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to load properties.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // ---------- Helpers ----------
  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const scrollToForm = () => {
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleFieldChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // ---------- Add new (top-right button) ----------
  const handleAddNewClick = () => {
    resetForm();
    setError(null);
    setSuccess(null);
    scrollToForm();
  };

  // ---------- Save (create/update) ----------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.name.trim()) {
      setError('Property name is required.');
      return;
    }

    setSaving(true);

    const monthly_rent =
      form.monthlyRent.trim() === '' ? null : Number(form.monthlyRent);

    try {
      if (editingId) {
        const { data, error: updateError } = await supabase
          .from('properties')
          .update({
            name: form.name.trim(),
            unit_label: form.unitLabel.trim() || null,
            monthly_rent,
            status: form.status,
            next_due_date: form.nextDueDate || null,
          })
          .eq('id', editingId)
          .select()
          .single();

        if (updateError) throw updateError;

        setProperties((prev) =>
          prev.map((p) => (p.id === editingId ? (data as PropertyRow) : p))
        );
        setSuccess('Property updated.');
      } else {
        const { data, error: insertError } = await supabase
          .from('properties')
          .insert({
            name: form.name.trim(),
            unit_label: form.unitLabel.trim() || null,
            monthly_rent,
            status: form.status,
            next_due_date: form.nextDueDate || null,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        setProperties((prev) => [data as PropertyRow, ...prev]);
        setSuccess('Property created.');
      }

      resetForm();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save property.');
    } finally {
      setSaving(false);
    }
  };

  // ---------- Edit existing ----------
  const handleEdit = (property: PropertyRow) => {
    setEditingId(property.id);
    setForm({
      name: property.name || '',
      unitLabel: property.unit_label || '',
      monthlyRent: property.monthly_rent ? String(property.monthly_rent) : '',
      status: (property.status as FormState['status']) || 'current',
      nextDueDate: property.next_due_date
        ? property.next_due_date.slice(0, 10)
        : '',
    });
    setError(null);
    setSuccess(null);
    scrollToForm();
  };

  // ---------- Delete property ----------
  const handleDelete = async (property: PropertyRow) => {
    const ok = window.confirm(
      `Delete property "${property.name || 'Property'}${
        property.unit_label ? ' · ' + property.unit_label : ''
      }"? This cannot be undone.`
    );
    if (!ok) return;

    setError(null);
    setSuccess(null);

    try {
      const { error: deleteError } = await supabase
        .from('properties')
        .delete()
        .eq('id', property.id);

      if (deleteError) {
        // Helpful message if there are foreign key constraints
        if (
          typeof deleteError.message === 'string' &&
          deleteError.message.toLowerCase().includes('foreign key')
        ) {
          throw new Error(
            'Cannot delete a property that has tenants or payments linked to it. Move or delete those first.'
          );
        }
        throw deleteError;
      }

      setProperties((prev) => prev.filter((p) => p.id !== property.id));
      setSuccess('Property deleted.');
      if (editingId === property.id) resetForm();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to delete property.');
    }
  };

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xs text-slate-500 flex gap-2">
              <button
                type="button"
                onClick={() => router.push('/landlord')}
                className="hover:text-emerald-400"
              >
                Landlord
              </button>
              <span>/</span>
              <span className="text-slate-300">Properties</span>
            </div>
            <h1 className="text-xl font-semibold mt-1">Properties</h1>
            <p className="text-[13px] text-slate-400">
              Manage units, rent amounts, and next due dates. This data powers
              your dashboard and tenant portal.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push('/landlord')}
            className="text-xs px-4 py-2 rounded-full border border-slate-700 bg-slate-900 hover:bg-slate-800"
          >
            Back to dashboard
          </button>
        </div>

        {(error || success) && (
          <div className="mb-4 space-y-2 text-sm">
            {error && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-100">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-100">
                {success}
              </div>
            )}
          </div>
        )}

        {/* Two-column layout: list left, form right */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)]">
          {/* LEFT: Properties list */}
          <section className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  Units
                </p>
                <p className="mt-1 text-sm font-medium text-slate-50">
                  {properties.length} record
                  {properties.length === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddNewClick}
                className="text-xs px-3 py-1.5 rounded-full bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400"
              >
                + Add unit
              </button>
            </div>

            {loading ? (
              <p className="text-xs text-slate-500 mt-2">
                Loading properties…
              </p>
            ) : properties.length === 0 ? (
              <p className="text-xs text-slate-500 mt-2">
                No properties yet. Use &quot;Add unit&quot; to create your first
                one.
              </p>
            ) : (
              <div className="space-y-2 mt-3">
                {properties.map((p) => {
                  const status = p.status?.toLowerCase() || 'current';
                  const badgeClasses =
                    status === 'current'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                      : status === 'vacant'
                      ? 'bg-slate-500/15 text-slate-300 border-slate-500/40'
                      : status === 'notice'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                      : 'bg-slate-700/20 text-slate-300 border-slate-600/40';

                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-slate-50">
                          {p.name || 'Untitled property'}
                          {p.unit_label ? ` · ${p.unit_label}` : ''}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Rent:{' '}
                          <span className="text-slate-100">
                            {formatCurrency(p.monthly_rent)}
                          </span>
                        </p>
                        {p.next_due_date && (
                          <p className="text-[11px] text-slate-500">
                            Next due: {formatDate(p.next_due_date)}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`px-3 py-0.5 rounded-full border text-[11px] ${badgeClasses}`}
                        >
                          {p.status || 'current'}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(p)}
                            className="text-[11px] px-3 py-1 rounded-full border border-slate-700 bg-slate-900 hover:bg-slate-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p)}
                            className="text-[11px] px-3 py-1 rounded-full border border-rose-500/60 text-rose-200 bg-rose-950/40 hover:bg-rose-950/70"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* RIGHT: Add / edit property form */}
          <section
            ref={formRef}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800"
          >
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
              {editingId ? 'Edit unit' : 'Add unit'}
            </p>
            <h2 className="text-sm font-medium text-slate-50 mb-3">
              {editingId
                ? 'Update property details'
                : 'Create a new property / unit'}
            </h2>

            <form className="space-y-3" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Property name</label>
                  <input
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    value={form.name}
                    onChange={(e) =>
                      handleFieldChange('name', e.target.value)
                    }
                    placeholder="Main"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Unit label</label>
                  <input
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    value={form.unitLabel}
                    onChange={(e) =>
                      handleFieldChange('unitLabel', e.target.value)
                    }
                    placeholder="1A, 2B, Apt 3, etc."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">
                    Monthly rent
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    value={form.monthlyRent}
                    onChange={(e) =>
                      handleFieldChange('monthlyRent', e.target.value)
                    }
                    placeholder="e.g. 2000"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Status</label>
                  <select
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    value={form.status}
                    onChange={(e) =>
                      handleFieldChange(
                        'status',
                        e.target.value as FormState['status']
                      )
                    }
                  >
                    <option value="current">Current (occupied)</option>
                    <option value="vacant">Vacant</option>
                    <option value="notice">Notice given</option>
                    <option value="inactive">Inactive / off-market</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400">
                  Next rent due date
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  value={form.nextDueDate}
                  onChange={(e) =>
                    handleFieldChange('nextDueDate', e.target.value)
                  }
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  This powers the &quot;Overdue / Upcoming 7 days / Not due
                  yet&quot; cards on your dashboard.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-60"
                >
                  {saving
                    ? 'Saving…'
                    : editingId
                    ? 'Save changes'
                    : 'Create property'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={handleAddNewClick}
                    className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-xs hover:bg-slate-800"
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
