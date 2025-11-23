'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

// ---------- Types ----------

type PropertyRow = {
  id: number;
  name: string | null;
  unit_label: string | null;
};

type TenantRow = {
  id: number;
  created_at: string | null;
  name: string | null;
  email: string;
  phone: string | null;
  property_id: number | null;
  monthly_rent: number | null;
  status: string | null;
  lease_start: string | null;
  lease_end: string | null;
  owner_id: string | null;
};

// ---------- Helpers ----------

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

// ---------- Component ----------

export default function LandlordTenantsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [monthlyRent, setMonthlyRent] = useState<string>('');
  const [status, setStatus] = useState('Current');
  const [leaseStart, setLeaseStart] = useState('');
  const [leaseEnd, setLeaseEnd] = useState('');
  const [showPassword, setShowPassword] = useState(false); // future use if you ever add tenant login

  // ---------- Load user + data ----------

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

        // Load properties + tenants owned by this landlord
        const [propsRes, tenantsRes] = await Promise.all([
          supabase
            .from('properties')
            .select('id, name, unit_label')
            .order('created_at', { ascending: false }),
          supabase
            .from('tenants')
            .select('*')
            .order('created_at', { ascending: false }),
        ]);

        if (propsRes.error) throw propsRes.error;
        if (tenantsRes.error) throw tenantsRes.error;

        setProperties((propsRes.data || []) as PropertyRow[]);
        setTenants((tenantsRes.data || []) as TenantRow[]);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message || 'Failed to load tenants. Please refresh and try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  // ---------- Helpers ----------

  const resetForm = () => {
    setEditingId(null);
    setFullName('');
    setEmail('');
    setPhone('');
    setPropertyId(null);
    setMonthlyRent('');
    setStatus('Current');
    setLeaseStart('');
    setLeaseEnd('');
  };

  const beginEdit = (tenant: TenantRow) => {
    setEditingId(tenant.id);
    setFullName(tenant.name || '');
    setEmail(tenant.email || '');
    setPhone(tenant.phone || '');
    setPropertyId(tenant.property_id);
    setMonthlyRent(
      tenant.monthly_rent != null ? String(tenant.monthly_rent) : ''
    );
    setStatus(tenant.status || 'Current');
    setLeaseStart(tenant.lease_start || '');
    setLeaseEnd(tenant.lease_end || '');
    setSuccess(null);
    setError(null);
  };

  const handleDelete = async (tenantId: number) => {
    if (!confirm('Delete this tenant? This cannot be undone.')) return;
    setError(null);
    setSuccess(null);

    try {
      const { error: delError } = await supabase
        .from('tenants')
        .delete()
        .eq('id', tenantId);

      if (delError) throw delError;

      setTenants((prev) => prev.filter((t) => t.id !== tenantId));
      if (editingId === tenantId) {
        resetForm();
      }
      setSuccess('Tenant deleted.');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to delete tenant.');
    }
  };

  // ---------- Submit (create or update) ----------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setError('Not logged in.');
      return;
    }

    // basic client-side check
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: Partial<TenantRow> = {
        name: fullName.trim() || null,
        email: email.trim(),
        phone: phone.trim() || null,
        property_id: propertyId,
        monthly_rent: monthlyRent ? Number(monthlyRent) : null,
        status: status.trim() || null,
        lease_start: leaseStart || null,
        lease_end: leaseEnd || null,
      };

      if (editingId == null) {
        // CREATE
        const { data, error: insertError } = await supabase
          .from('tenants')
          .insert([{ ...payload, owner_id: userId }])
          .select('*')
          .single();

        if (insertError) throw insertError;

        setTenants((prev) => [data as TenantRow, ...prev]);
        resetForm();
        setSuccess('Tenant created.');
      } else {
        // UPDATE (RLS will ensure owner_id matches auth user)
        const { data, error: updateError } = await supabase
          .from('tenants')
          .update(payload)
          .eq('id', editingId)
          .select('*')
          .single();

        if (updateError) throw updateError;

        setTenants((prev) =>
          prev.map((t) => (t.id === editingId ? (data as TenantRow) : t))
        );
        resetForm();
        setSuccess('Tenant updated.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to save tenant.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/landlord/login');
  };

  // ---------- UI ----------

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading tenants…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header / breadcrumb */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs text-slate-500 flex gap-2">
              <Link href="/landlord" className="hover:text-emerald-400">
                Landlord
              </Link>
              <span>/</span>
              <span className="text-slate-300">Tenants</span>
            </div>
            <h1 className="mt-1 text-xl font-semibold text-slate-50">
              Tenants
            </h1>
            <p className="text-[13px] text-slate-400">
              Manage who lives in each unit, their contact details, and rent.
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

        {/* Alerts */}
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

        {/* Layout: list + form */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)]">
          {/* Tenants list */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  Current tenants
                </p>
                <p className="mt-1 text-sm font-medium text-slate-50">
                  {tenants.length} record{tenants.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            {tenants.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500">
                No tenants yet. Use the form on the right to create your first
                record.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {tenants.map((t) => {
                  const prop = properties.find((p) => p.id === t.property_id);
                  return (
                    <div
                      key={t.id}
                      className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs flex items-start justify-between gap-3"
                    >
                      <div>
                        <p className="font-medium text-slate-100">
                          {t.name || t.email}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {t.email}
                          {t.phone ? ` • ${t.phone}` : ''}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {prop
                            ? `${prop.name || 'Property'}${
                                prop.unit_label ? ` · ${prop.unit_label}` : ''
                              }`
                            : 'Unassigned'}
                          {' • '}
                          {formatCurrency(t.monthly_rent)}
                        </p>
                        {t.lease_start && (
                          <p className="text-[11px] text-slate-500">
                            Lease:{' '}
                            {formatDate(t.lease_start)}{' '}
                            {t.lease_end ? `– ${formatDate(t.lease_end)}` : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => beginEdit(t)}
                          className="rounded-full border border-slate-600 px-2 py-0.5 text-[10px] text-slate-100 hover:bg-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(t.id)}
                          className="rounded-full border border-rose-600 px-2 py-0.5 text-[10px] text-rose-100 hover:bg-rose-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Form */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
              {editingId ? 'Edit tenant' : 'Add tenant'}
            </p>
            <p className="text-[13px] text-slate-400 mb-4">
              {editingId
                ? 'Update tenant details and rent.'
                : 'Create a tenant record for each person renting a unit.'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block text-slate-300">Full name</label>
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Bob Tenant"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-300">Email (login)</label>
                <input
                  type="email"
                  required
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tenant@example.com"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-300">Phone</label>
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="optional"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-300">Property / Unit</label>
                  <select
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                    value={propertyId ?? ''}
                    onChange={(e) =>
                      setPropertyId(
                        e.target.value ? Number(e.target.value) : null
                      )
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
                  <label className="block text-slate-300">
                    Monthly rent (override)
                  </label>
                  <input
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(e.target.value)}
                    placeholder="e.g. 1500"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-300">Status</label>
                  <select
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option>Current</option>
                    <option>Future</option>
                    <option>Past</option>
                  </select>
                </div>

                <div />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-300">Lease start</label>
                  <input
                    type="date"
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                    value={leaseStart}
                    onChange={(e) => setLeaseStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-300">Lease end</label>
                  <input
                    type="date"
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                    value={leaseEnd}
                    onChange={(e) => setLeaseEnd(e.target.value)}
                  />
                </div>
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
                    : 'Create tenant'}
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
