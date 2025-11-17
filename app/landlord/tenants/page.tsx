'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

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
  created_at?: string;
};

type PropertyRow = {
  id: number;
  name: string | null;
  unit_label: string | null;
  monthly_rent: number | null;
};

type FormState = {
  name: string;
  email: string;
  phone: string;
  propertyId: string;
  monthlyRent: string;
  status: 'current' | 'late' | 'notice' | 'inactive';
  leaseStart: string;
  leaseEnd: string;
};

const emptyForm: FormState = {
  name: '',
  email: '',
  phone: '',
  propertyId: '',
  monthlyRent: '',
  status: 'current',
  leaseStart: '',
  leaseEnd: '',
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

export default function LandlordTenantsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const formRef = useRef<HTMLDivElement | null>(null);

  // ---------- Load tenants + properties ----------
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [tenantRes, propRes] = await Promise.all([
          supabase
            .from('tenants')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('properties')
            .select('id, name, unit_label, monthly_rent')
            .order('id'),
        ]);

        if (tenantRes.error) throw tenantRes.error;
        if (propRes.error) throw propRes.error;

        setTenants((tenantRes.data || []) as TenantRow[]);
        setProperties((propRes.data || []) as PropertyRow[]);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to load tenants.');
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

  const handleCancelEdit = () => {
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

    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required.');
      return;
    }

    setSaving(true);

    const property_id =
      form.propertyId.trim() === '' ? null : Number(form.propertyId);
    const monthly_rent =
      form.monthlyRent.trim() === '' ? null : Number(form.monthlyRent);

    try {
      if (editingId) {
        const { data, error: updateError } = await supabase
          .from('tenants')
          .update({
            name: form.name.trim(),
            email: form.email.trim().toLowerCase(),
            phone: form.phone.trim() || null,
            property_id,
            monthly_rent,
            status: form.status,
            lease_start: form.leaseStart || null,
            lease_end: form.leaseEnd || null,
          })
          .eq('id', editingId)
          .select()
          .single();

        if (updateError) throw updateError;

        setTenants((prev) =>
          prev.map((t) => (t.id === editingId ? (data as TenantRow) : t))
        );
        setSuccess('Tenant updated.');
      } else {
        const { data, error: insertError } = await supabase
          .from('tenants')
          .insert({
            name: form.name.trim(),
            email: form.email.trim().toLowerCase(),
            phone: form.phone.trim() || null,
            property_id,
            monthly_rent,
            status: form.status,
            lease_start: form.leaseStart || null,
            lease_end: form.leaseEnd || null,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        setTenants((prev) => [data as TenantRow, ...prev]);
        setSuccess('Tenant created.');
      }

      resetForm();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save tenant.');
    } finally {
      setSaving(false);
    }
  };

  // ---------- Edit ----------
  const handleEdit = (tenant: TenantRow) => {
    setEditingId(tenant.id);
    setForm({
      name: tenant.name || '',
      email: tenant.email || '',
      phone: tenant.phone || '',
      propertyId: tenant.property_id ? String(tenant.property_id) : '',
      monthlyRent: tenant.monthly_rent ? String(tenant.monthly_rent) : '',
      status: (tenant.status as FormState['status']) || 'current',
      leaseStart: tenant.lease_start ? tenant.lease_start.slice(0, 10) : '',
      leaseEnd: tenant.lease_end ? tenant.lease_end.slice(0, 10) : '',
    });
    setError(null);
    setSuccess(null);
    scrollToForm();
  };

  // ---------- Delete ----------
  const handleDelete = async (tenant: TenantRow) => {
    const ok = window.confirm(
      `Delete tenant "${tenant.name || tenant.email}"? This cannot be undone.`
    );
    if (!ok) return;

    setError(null);
    setSuccess(null);

    try {
      const { error: deleteError } = await supabase
        .from('tenants')
        .delete()
        .eq('id', tenant.id);

      if (deleteError) throw deleteError;

      setTenants((prev) => prev.filter((t) => t.id !== tenant.id));
      setSuccess('Tenant deleted.');
      if (editingId === tenant.id) resetForm();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to delete tenant.');
    }
  };

  const currentTenants = tenants;

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
              <span className="text-slate-300">Tenants</span>
            </div>
            <h1 className="text-xl font-semibold mt-1">Tenants</h1>
            <p className="text-[13px] text-slate-400">
              Manage who lives in each unit, their contact details, and rent.
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

        {/* Two-column layout */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)]">
          {/* LEFT: list */}
          <section className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  Current tenants
                </p>
                <p className="mt-1 text-sm font-medium text-slate-50">
                  {currentTenants.length} record
                  {currentTenants.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            {loading ? (
              <p className="text-xs text-slate-500 mt-2">Loading tenants…</p>
            ) : currentTenants.length === 0 ? (
              <p className="text-xs text-slate-500 mt-2">
                No tenants yet. Use the form on the right to create your first
                record.
              </p>
            ) : (
              <div className="space-y-2 mt-3">
                {currentTenants.map((t) => {
                  const property = t.property_id
                    ? properties.find((p) => p.id === t.property_id)
                    : null;

                  const status = t.status?.toLowerCase() || 'current';
                  const badgeClasses =
                    status === 'current'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                      : status === 'late'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                      : 'bg-slate-500/15 text-slate-300 border-slate-500/40';

                  const effectiveRent =
                    t.monthly_rent ??
                    (property ? property.monthly_rent : null);

                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-slate-50">
                          {t.name || t.email}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {t.email}
                          {t.phone ? ` • ${t.phone}` : ''}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {property ? (
                            <>
                              {property.name}
                              {property.unit_label
                                ? ` · ${property.unit_label}`
                                : ''}
                            </>
                          ) : (
                            'No unit assigned'
                          )}{' '}
                          • Rent:{' '}
                          <span className="text-slate-100">
                            {formatCurrency(effectiveRent)}
                          </span>
                        </p>
                        {(t.lease_start || t.lease_end) && (
                          <p className="text-[11px] text-slate-500">
                            Lease:{' '}
                            {t.lease_start ? formatDate(t.lease_start) : '?'}{' '}
                            – {t.lease_end ? formatDate(t.lease_end) : '?'}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`px-3 py-0.5 rounded-full border text-[11px] ${badgeClasses}`}
                        >
                          {t.status || 'current'}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(t)}
                            className="text-[11px] px-3 py-1 rounded-full border border-slate-700 bg-slate-900 hover:bg-slate-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(t)}
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

          {/* RIGHT: form */}
          <section
            ref={formRef}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800"
          >
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
              {editingId ? 'Edit tenant' : 'Add tenant'}
            </p>
            <h2 className="text-sm font-medium text-slate-50 mb-3">
              {editingId
                ? 'Update tenant details'
                : 'Create a new tenant record'}
            </h2>

            <form className="space-y-3" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Full name</label>
                  <input
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    value={form.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    placeholder="Jane Tenant"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Email (login)</label>
                  <input
                    type="email"
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    value={form.email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    placeholder="tenant@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Phone</label>
                  <input
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    value={form.phone}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                    placeholder="(401) 555-1234"
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
                    <option value="current">Current</option>
                    <option value="late">Late</option>
                    <option value="notice">Notice given</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">
                    Property / Unit
                  </label>
                  <select
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    value={form.propertyId}
                    onChange={(e) =>
                      handleFieldChange('propertyId', e.target.value)
                    }
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

                <div className="space-y-1">
                  <label className="text-xs text-slate-400">
                    Monthly rent (optional override)
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
                    placeholder="e.g. 1500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Lease start</label>
                  <input
                    type="date"
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    value={form.leaseStart}
                    onChange={(e) =>
                      handleFieldChange('leaseStart', e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Lease end</label>
                  <input
                    type="date"
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    value={form.leaseEnd}
                    onChange={(e) =>
                      handleFieldChange('leaseEnd', e.target.value)
                    }
                  />
                </div>
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
                    : 'Create tenant'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
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
