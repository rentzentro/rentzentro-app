'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

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

// ---------- Component ----------
export default function LandlordTenantsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);

  // form state
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

  // ---------- Actions ----------
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/landlord/login');
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

  const handleCreateTenant = async () => {
    if (!userId) {
      setError('Missing landlord account. Please log in again.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: insertError } = await supabase.from('tenants').insert({
        name: fullName || null,
        email: tenantEmail || userEmail || '',
        phone: phone || null,
        property_id:
          typeof propertyId === 'number' ? propertyId : (null as any),
        monthly_rent: monthlyRent ? Number(monthlyRent) : null,
        status,
        lease_start: leaseStart || null,
        lease_end: leaseEnd || null,
        owner_id: userId, // 🔑 critical for RLS
      });

      if (insertError) {
        console.error('Insert tenant error:', insertError);
        setError(insertError.message || 'Failed to create tenant.');
        return;
      }

      setSuccess('Tenant created.');
      setFullName('');
      setTenantEmail('');
      setPhone('');
      setStatus('Current');
      setPropertyId('');
      setMonthlyRent('');
      setLeaseStart('');
      setLeaseEnd('');

      await reloadTenants(userId);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unexpected error creating tenant.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTenant = async (tenantId: number) => {
    if (!userId) return;

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
        <section className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.1fr)]">
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
                {tenants.map((t) => (
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
                      <p className="text-[11px] text-slate-500">
                        Status:{' '}
                        <span className="text-slate-200">
                          {t.status || 'Unknown'}
                        </span>{' '}
                        • Rent:{' '}
                        <span className="text-slate-200">
                          {formatCurrency(t.monthly_rent)}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteTenant(t.id)}
                      className="text-[11px] px-2 py-1 rounded-full border border-rose-500/60 text-rose-200 hover:bg-rose-950/40"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: add tenant */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Add tenant
            </p>
            <p className="text-[13px] text-slate-400">
              Create a new tenant record and optionally link them to a
              property.
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
                  Email (tenant login in future)
                </label>
                <input
                  value={tenantEmail}
                  onChange={(e) => setTenantEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                  placeholder="tenant@example.com"
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

              <button
                type="button"
                onClick={handleCreateTenant}
                disabled={saving}
                className="mt-3 w-full rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {saving ? 'Creating…' : 'Create tenant'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
