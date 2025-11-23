'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

type TenantRow = {
  id: number;
  created_at: string | null;
  name: string | null;
  email: string;
  phone: string | null;
  status: string | null;
  property_id: number | null;
  lease_start: string | null;
  lease_end: string | null;
  owner_id: string | null;
};

type PropertyRow = {
  id: number;
  created_at: string | null;
  name: string | null;
  unit_label: string | null;
  monthly_rent: number | null;
  status: string | null;
  next_due_date: string | null;
  owner_id: string | null;
};

const formatCurrency = (v: number | null | undefined) =>
  v == null || isNaN(v)
    ? '-'
    : v.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
      });

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);

  const [ownerId, setOwnerId] = useState<string | null>(null);

  // new tenant form
  const [newTenant, setNewTenant] = useState({
    name: '',
    email: '',
    phone: '',
    status: 'Current',
    property_id: '' as string | '',
    lease_start: '',
    lease_end: '',
  });

  // edit tenant
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    status: '',
    property_id: '' as string | '',
    lease_start: '',
    lease_end: '',
  });

  // ---------- Load landlord + data ----------

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError) throw authError;
        const user = authData.user;
        if (!user) {
          router.push('/landlord/login');
          return;
        }
        const uid = user.id;
        setOwnerId(uid);

        // Properties for this landlord
        const { data: props, error: propError } = await supabase
          .from('properties')
          .select(
            'id, created_at, name, unit_label, monthly_rent, status, next_due_date, owner_id'
          )
          .eq('owner_id', uid)
          .order('created_at', { ascending: true });

        if (propError) throw propError;
        setProperties((props || []) as PropertyRow[]);

        // Tenants for this landlord
        const { data: tenantRows, error: tenantError } = await supabase
          .from('tenants')
          .select(
            'id, created_at, name, email, phone, status, property_id, lease_start, lease_end, owner_id'
          )
          .eq('owner_id', uid)
          .order('created_at', { ascending: true });

        if (tenantError) throw tenantError;
        setTenants((tenantRows || []) as TenantRow[]);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ||
            'Failed to load tenants. Please refresh the page and try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const propertyMap = new Map<number, PropertyRow>();
  for (const p of properties) {
    propertyMap.set(p.id, p);
  }

  // ---------- Handlers ----------

  const handleNewChange = (
    field: keyof typeof newTenant,
    value: string
  ) => {
    setNewTenant((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditChange = (
    field: keyof typeof editForm,
    value: string
  ) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerId) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (!newTenant.email.trim()) {
        throw new Error('Tenant email is required.');
      }

      const propertyId =
        newTenant.property_id === ''
          ? null
          : Number(newTenant.property_id);

      const { data, error: insertError } = await supabase
        .from('tenants')
        .insert({
          name: newTenant.name || null,
          email: newTenant.email.trim(),
          phone: newTenant.phone || null,
          status: newTenant.status || null,
          property_id: propertyId,
          lease_start: newTenant.lease_start || null,
          lease_end: newTenant.lease_end || null,
          owner_id: ownerId,
        })
        .select('*')
        .single();

      if (insertError) throw insertError;

      setTenants((prev) => [...prev, data as TenantRow]);
      setSuccess('Tenant added. Don’t forget to send their invite email.');
      setNewTenant({
        name: '',
        email: '',
        phone: '',
        status: 'Current',
        property_id: '',
        lease_start: '',
        lease_end: '',
      });
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Failed to create tenant. Please double-check the details and try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (t: TenantRow) => {
    setEditingId(t.id);
    setEditForm({
      name: t.name || '',
      email: t.email,
      phone: t.phone || '',
      status: t.status || '',
      property_id: t.property_id ? String(t.property_id) : '',
      lease_start: t.lease_start || '',
      lease_end: t.lease_end || '',
    });
    setSuccess(null);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      name: '',
      email: '',
      phone: '',
      status: '',
      property_id: '',
      lease_start: '',
      lease_end: '',
    });
  };

  const saveEdit = async (id: number) => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const propertyId =
        editForm.property_id === ''
          ? null
          : Number(editForm.property_id);

      const { data, error: updateError } = await supabase
        .from('tenants')
        .update({
          name: editForm.name || null,
          email: editForm.email.trim(),
          phone: editForm.phone || null,
          status: editForm.status || null,
          property_id: propertyId,
          lease_start: editForm.lease_start || null,
          lease_end: editForm.lease_end || null,
        })
        .eq('id', id)
        .select('*')
        .single();

      if (updateError) throw updateError;

      setTenants((prev) =>
        prev.map((t) => (t.id === id ? (data as TenantRow) : t))
      );
      setSuccess('Tenant updated.');
      cancelEdit();
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Failed to update tenant. Please review the details and try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteTenant = async (id: number) => {
    if (!window.confirm('Delete this tenant record? This cannot be undone.')) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: deleteError } = await supabase
        .from('tenants')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setTenants((prev) => prev.filter((t) => t.id !== id));
      setSuccess('Tenant deleted.');
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Failed to delete tenant. Please try again in a moment.'
      );
    } finally {
      setSaving(false);
    }
  };

  // ---------- Render ----------

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">
          Loading your tenants…
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">
              Tenants
            </h1>
            <p className="text-[11px] text-slate-400">
              Manage who lives in each unit, their contact details, and their
              linked rent. Rent is controlled on the property.
            </p>
          </div>
        </header>

        {(error || success) && (
          <div
            className={`rounded-xl border px-4 py-2 text-sm ${
              error
                ? 'border-red-500/60 bg-red-500/10 text-red-200'
                : 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
            }`}
          >
            {error || success}
          </div>
        )}

        {/* Grid: current tenants + add form */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
          {/* Current tenants */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  Current tenants
                </p>
                <p className="mt-1 text-sm font-medium text-slate-50">
                  {tenants.length === 0
                    ? 'No tenants yet'
                    : `${tenants.length} tenant${
                        tenants.length === 1 ? '' : 's'
                      }`}
                </p>
              </div>
            </div>

            {tenants.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">
                No tenants on file yet. Add your first tenant using the form on
                the right.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                {tenants.map((t) => {
                  const prop = t.property_id
                    ? propertyMap.get(t.property_id)
                    : undefined;
                  const isEditing = editingId === t.id;

                  return (
                    <div
                      key={t.id}
                      className="px-3 py-3 bg-slate-950/60 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="space-y-1 text-xs md:flex-1">
                        {isEditing ? (
                          <>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                                placeholder="Full name"
                                value={editForm.name}
                                onChange={(e) =>
                                  handleEditChange(
                                    'name',
                                    e.target.value
                                  )
                                }
                              />
                              <input
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                                placeholder="Email"
                                value={editForm.email}
                                onChange={(e) =>
                                  handleEditChange(
                                    'email',
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                            <div className="mt-1 flex flex-col sm:flex-row gap-2">
                              <input
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                                placeholder="Phone"
                                value={editForm.phone}
                                onChange={(e) =>
                                  handleEditChange(
                                    'phone',
                                    e.target.value
                                  )
                                }
                              />
                              <select
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                                value={editForm.status}
                                onChange={(e) =>
                                  handleEditChange(
                                    'status',
                                    e.target.value
                                  )
                                }
                              >
                                <option value="">Status not set</option>
                                <option value="Current">Current</option>
                                <option value="Former">Former</option>
                                <option value="Prospect">
                                  Prospect
                                </option>
                              </select>
                            </div>
                            <div className="mt-1 flex flex-col sm:flex-row gap-2">
                              <select
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                                value={editForm.property_id}
                                onChange={(e) =>
                                  handleEditChange(
                                    'property_id',
                                    e.target.value
                                  )
                                }
                              >
                                <option value="">
                                  Not assigned to a unit
                                </option>
                                {properties.map((p) => (
                                  <option
                                    key={p.id}
                                    value={String(p.id)}
                                  >
                                    {p.name || 'Property'}{' '}
                                    {p.unit_label
                                      ? `· ${p.unit_label}`
                                      : ''}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="date"
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                                value={editForm.lease_start}
                                onChange={(e) =>
                                  handleEditChange(
                                    'lease_start',
                                    e.target.value
                                  )
                                }
                              />
                              <input
                                type="date"
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                                value={editForm.lease_end}
                                onChange={(e) =>
                                  handleEditChange(
                                    'lease_end',
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="font-medium text-slate-50 text-[13px]">
                              {t.name || 'Unnamed tenant'}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {t.email}
                              {t.phone
                                ? ` • ${t.phone}`
                                : ''}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Unit:{' '}
                              <span className="text-slate-100">
                                {prop
                                  ? `${prop.name || 'Property'}${
                                      prop.unit_label
                                        ? ` · ${prop.unit_label}`
                                        : ''
                                    }`
                                  : 'Not assigned'}
                              </span>
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Rent (from property):{' '}
                              <span className="text-slate-100">
                                {prop
                                  ? formatCurrency(
                                      prop.monthly_rent
                                    )
                                  : '-'}
                              </span>
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Lease:{' '}
                              <span className="text-slate-100">
                                {formatDate(t.lease_start)} –{' '}
                                {formatDate(t.lease_end)}
                              </span>
                            </p>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] mt-2 md:mt-0">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEdit(t.id)}
                              disabled={saving}
                              className="rounded-full bg-emerald-500 px-3 py-1 font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 font-medium text-slate-100 hover:bg-slate-800"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-200">
                              {t.status || 'Status not set'}
                            </span>
                            <button
                              onClick={() => startEdit(t)}
                              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 font-medium text-slate-100 hover:bg-slate-800"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteTenant(t.id)}
                              className="rounded-full border border-red-500/60 bg-red-500/10 px-3 py-1 font-medium text-red-100 hover:bg-red-500/20"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Add tenant */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Add tenant
            </p>
            <p className="mt-1 text-sm font-medium text-slate-50">
              Create a new tenant record
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              After adding a tenant, send them an invite email so they can
              activate their tenant portal account.
            </p>

            <form
              onSubmit={handleCreateTenant}
              className="mt-3 space-y-3 text-xs"
            >
              <div className="flex flex-col gap-2">
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                  placeholder="Full name (optional)"
                  value={newTenant.name}
                  onChange={(e) =>
                    handleNewChange('name', e.target.value)
                  }
                />
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                  placeholder="Email (login)"
                  type="email"
                  value={newTenant.email}
                  onChange={(e) =>
                    handleNewChange('email', e.target.value)
                  }
                  required
                />
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                  placeholder="Phone (optional)"
                  value={newTenant.phone}
                  onChange={(e) =>
                    handleNewChange('phone', e.target.value)
                  }
                />
              </div>

              <div className="flex flex-col gap-2">
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                  value={newTenant.status}
                  onChange={(e) =>
                    handleNewChange('status', e.target.value)
                  }
                >
                  <option value="Current">Current</option>
                  <option value="Former">Former</option>
                  <option value="Prospect">Prospect</option>
                </select>

                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                  value={newTenant.property_id}
                  onChange={(e) =>
                    handleNewChange('property_id', e.target.value)
                  }
                >
                  <option value="">
                    Not assigned to a unit yet
                  </option>
                  {properties.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name || 'Property'}
                      {p.unit_label ? ` · ${p.unit_label}` : ''}{' '}
                      {p.monthly_rent != null
                        ? ` (${formatCurrency(
                            p.monthly_rent
                          )})`
                        : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-[10px] text-slate-500">
                      Lease start
                    </label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                      value={newTenant.lease_start}
                      onChange={(e) =>
                        handleNewChange(
                          'lease_start',
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-[10px] text-slate-500">
                      Lease end
                    </label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                      value={newTenant.lease_end}
                      onChange={(e) =>
                        handleNewChange(
                          'lease_end',
                          e.target.value
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="mt-2 inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Create tenant'}
              </button>
            </form>

            <p className="mt-3 text-[11px] text-slate-500">
              Rent amount is controlled on the property, and tenants inherit
              that rent automatically in their portal and online payments.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
