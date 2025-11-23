'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabaseClient';

// ---------- Types ----------
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

type PropertyRow = {
  id: number;
  name: string | null;
  unit_label: string | null;
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
  const [invitingId, setInvitingId] = useState<number | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [fullName, setFullName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'Current' | 'Past' | 'Prospect'>(
    'Current'
  );
  const [propertyId, setPropertyId] = useState<number | ''>('');
  const [monthlyRent, setMonthlyRent] = useState<string>('');
  const [leaseStart, setLeaseStart] = useState('');
  const [leaseEnd, setLeaseEnd] = useState('');

  // ---------- Load landlord + data ----------
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error('Auth error / no user:', authError);
        router.push('/landlord/login');
        return;
      }

      const uid = user.id;
      const email = user.email ?? null;
      setUserId(uid);
      setUserEmail(email);

      try {
        const [tenantRes, propertyRes] = await Promise.all([
          supabase
            .from('tenants')
            .select('*')
            .eq('owner_id', uid)
            .order('created_at', { ascending: false }),
          supabase
            .from('properties')
            .select('id, name, unit_label')
            .eq('owner_id', uid)
            .order('created_at', { ascending: true }),
        ]);

        if (tenantRes.error) throw tenantRes.error;
        if (propertyRes.error) throw propertyRes.error;

        setTenants((tenantRes.data || []) as TenantRow[]);
        setProperties((propertyRes.data || []) as PropertyRow[]);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to load tenants.');
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
    setTenantEmail('');
    setPhone('');
    setStatus('Current');
    setPropertyId('');
    setMonthlyRent('');
    setLeaseStart('');
    setLeaseEnd('');
  };

  const reloadTenants = async (uid: string) => {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('owner_id', uid)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setTenants((data || []) as TenantRow[]);
  };

  const beginEdit = (tenant: TenantRow) => {
    setEditingId(tenant.id);
    setFullName(tenant.name || '');
    setTenantEmail(tenant.email);
    setPhone(tenant.phone || '');
    setStatus(
      (tenant.status as 'Current' | 'Past' | 'Prospect') || 'Current'
    );
    setPropertyId(tenant.property_id ?? '');
    setMonthlyRent(
      tenant.monthly_rent != null ? String(tenant.monthly_rent) : ''
    );
    setLeaseStart(tenant.lease_start || '');
    setLeaseEnd(tenant.lease_end || '');
    setError(null);
    setSuccess(null);
  };

  // ---------- Actions ----------
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/landlord/login');
  };

  const handleCreateOrUpdateTenant = async () => {
    if (!userId) {
      setError('Missing landlord account. Please log in again.');
      return;
    }

    if (!tenantEmail.trim()) {
      setError('Tenant email is required.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        name: fullName || null,
        email: tenantEmail.trim(),
        phone: phone || null,
        property_id:
          typeof propertyId === 'number' ? propertyId : (null as any),
        monthly_rent: monthlyRent ? Number(monthlyRent) : null,
        status,
        lease_start: leaseStart || null,
        lease_end: leaseEnd || null,
      };

      if (editingId) {
        // UPDATE
        const { error: updateError } = await supabase
          .from('tenants')
          .update(payload)
          .eq('id', editingId)
          .eq('owner_id', userId);

        if (updateError) {
          console.error('Update tenant error:', updateError);
          setError(updateError.message || 'Failed to update tenant.');
          return;
        }

        setSuccess('Tenant updated.');
      } else {
        // CREATE
        const { error: insertError } = await supabase.from('tenants').insert({
          ...payload,
          owner_id: userId, // 🔑 critical for RLS
        });

        if (insertError) {
          console.error('Insert tenant error:', insertError);
          setError(insertError.message || 'Failed to create tenant.');
          return;
        }

        setSuccess('Tenant created.');
      }

      resetForm();
      await reloadTenants(userId);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unexpected error saving tenant.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTenant = async (tenantId: number) => {
    if (!userId) return;

    if (!window.confirm('Delete this tenant?')) return;

    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', tenantId)
        .eq('owner_id', userId);

      if (error) {
        console.error('Delete tenant error:', error);
        setError(error.message || 'Failed to delete tenant.');
        return;
      }

      setSuccess('Tenant deleted.');
      await reloadTenants(userId);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unexpected error deleting tenant.');
    }
  };

  const handleSendInvite = async (tenant: TenantRow) => {
    if (!tenant.email) {
      setError('This tenant has no email address set.');
      return;
    }

    setInvitingId(tenant.id);
    setError(null);
    setSuccess(null);

    try {
      const property = tenant.property_id
        ? properties.find((p) => p.id === tenant.property_id)
        : null;

      const res = await fetch('/api/tenant-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantEmail: tenant.email,
          tenantName: tenant.name,
          propertyName:
            property && (property.name || property.unit_label)
              ? `${property.name || 'Your unit'}${
                  property.unit_label ? ` · ${property.unit_label}` : ''
                }`
              : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send invite email.');
      }

      setSuccess(`Portal invite sent to ${tenant.email}.`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error sending invite email.');
    } finally {
      setInvitingId(null);
    }
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
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
              className="text-xs px-3 py-2 rounded-full border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200"
            >
              Back to dashboard
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs px-3 py-2 rounded-full border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-100"
            >
              Log out
            </button>
          </div>
        </header>

        {/* Alerts */}
        {(error || success) && (
          <div
            className={`rounded-2xl border px-4 py-2 text-sm ${
              error
                ? 'border-rose-500/60 bg-rose-500/10 text-rose-100'
                : 'border-emerald-500/60 bg-emerald-500/10 text-emerald-100'
            }`}
          >
            {error || success}
          </div>
        )}

        {/* Content */}
        <section className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)]">
          {/* Left: tenants list */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
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
              <p className="mt-2 text-xs text-slate-500">
                No tenants yet. Use the form on the right to create your first
                record.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {tenants.map((t) => {
                  const prop = t.property_id
                    ? properties.find((p) => p.id === t.property_id)
                    : null;

                  return (
                    <div
                      key={t.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs"
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
                            Lease {formatDate(t.lease_start)}
                            {t.lease_end
                              ? ` – ${formatDate(t.lease_end)}`
                              : ''}
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
                          onClick={() => handleSendInvite(t)}
                          disabled={invitingId === t.id}
                          className="rounded-full border border-emerald-500 px-2 py-0.5 text-[10px] text-emerald-100 hover:bg-emerald-600/30 disabled:opacity-60"
                        >
                          {invitingId === t.id
                            ? 'Sending…'
                            : 'Send portal invite'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTenant(t.id)}
                          className="rounded-full border border-rose-500 px-2 py-0.5 text-[10px] text-rose-100 hover:bg-rose-700/40"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: add/edit tenant */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              {editingId ? 'Edit tenant' : 'Add tenant'}
            </p>
            <p className="text-[13px] text-slate-400">
              {editingId
                ? 'Update tenant details and rent.'
                : 'Create a new tenant record and optionally link them to a property.'}
            </p>

            <div className="space-y-2 text-xs">
              <div className="space-y-1">
                <label className="block text-slate-400">Full name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                  placeholder="Jane Doe"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400">
                  Email (tenant login)
                </label>
                <input
                  type="email"
                  value={tenantEmail}
                  onChange={(e) => setTenantEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                  placeholder="tenant@example.com"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400">Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                  placeholder="Optional"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-slate-400">Status</label>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(
                        e.target.value as 'Current' | 'Past' | 'Prospect'
                      )
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                  >
                    <option value="Current">Current</option>
                    <option value="Past">Past</option>
                    <option value="Prospect">Prospect</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-400">
                    Monthly rent (override)
                  </label>
                  <input
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400">Property / unit</label>
                <select
                  value={propertyId}
                  onChange={(e) =>
                    setPropertyId(
                      e.target.value ? Number(e.target.value) : ('' as any)
                    )
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                >
                  <option value="">Unassigned</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || 'Property'}{' '}
                      {p.unit_label ? `· ${p.unit_label}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-slate-400">Lease start</label>
                  <input
                    type="date"
                    value={leaseStart}
                    onChange={(e) => setLeaseStart(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400">Lease end</label>
                  <input
                    type="date"
                    value={leaseEnd}
                    onChange={(e) => setLeaseEnd(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCreateOrUpdateTenant}
                  disabled={saving}
                  className="w-full rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
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
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
