'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

type Tenant = {
  id: number;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  property_id: number | null;
  monthly_rent: number | null;
  status: string | null;
  lease_start: string | null;
  lease_end: string | null;
};

export default function LandlordTenantsPage() {
  const router = useRouter();

  // form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [status, setStatus] = useState<'Current' | 'Past' | 'Prospect'>('Current');
  const [leaseStart, setLeaseStart] = useState('');
  const [leaseEnd, setLeaseEnd] = useState('');

  // data / UI state
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);

  // -------- LOAD TENANTS --------
  useEffect(() => {
    const loadTenants = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        setError(error.message);
      } else {
        setTenants(data || []);
        setError(null);
      }
      setLoading(false);
    };

    loadTenants();
  }, []);

  // -------- FORM SUBMIT --------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || null,
      property_id: propertyId ? Number(propertyId) : null,
      monthly_rent: monthlyRent ? Number(monthlyRent) : null,
      status,
      lease_start: leaseStart || null,
      lease_end: leaseEnd || null,
    };

    let supabaseError = null;

    if (editingId) {
      const { error } = await supabase
        .from('tenants')
        .update(payload)
        .eq('id', editingId);

      supabaseError = error;
    } else {
      const { error } = await supabase.from('tenants').insert(payload);
      supabaseError = error;
    }

    if (supabaseError) {
      console.error(supabaseError);
      setError(supabaseError.message);
      setSaving(false);
      return;
    }

    // reload list
    const { data: refreshed } = await supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false });

    setTenants(refreshed || []);
    setSaving(false);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setPropertyId('');
    setMonthlyRent('');
    setStatus('Current');
    setLeaseStart('');
    setLeaseEnd('');
    setEditingId(null);
  };

  const handleEditClick = (tenant: Tenant) => {
    setEditingId(tenant.id);
    setName(tenant.name || '');
    setEmail(tenant.email || '');
    setPhone(tenant.phone || '');
    setPropertyId(tenant.property_id ? String(tenant.property_id) : '');
    setMonthlyRent(tenant.monthly_rent ? String(tenant.monthly_rent) : '');
    setStatus((tenant.status as any) || 'Current');
    setLeaseStart(tenant.lease_start || '');
    setLeaseEnd(tenant.lease_end || '');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this tenant?')) return;

    const { error } = await supabase.from('tenants').delete().eq('id', id);
    if (error) {
      console.error(error);
      setError(error.message);
      return;
    }

    setTenants((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) resetForm();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Tenant Management</h1>
            <p className="text-slate-400 text-sm">
              Add tenants, link them to properties, and track lease details.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/landlord"
              className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
            >
              Back to dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        </header>

        {/* FORM */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="font-medium">
            {editingId ? `Edit tenant #${editingId}` : 'Add a tenant'}
          </h2>

          {error && (
            <div className="rounded-xl bg-red-900/40 border border-red-500/60 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-1">
              <label className="block text-xs text-slate-400 mb-1">Tenant name</label>
              <input
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs text-slate-400 mb-1">Email</label>
              <input
                type="email"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs text-slate-400 mb-1">Phone</label>
              <input
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs text-slate-400 mb-1">Property ID (optional)</label>
              <input
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                placeholder="e.g. 1"
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs text-slate-400 mb-1">Monthly rent (USD)</label>
              <input
                type="number"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(e.target.value)}
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs text-slate-400 mb-1">Status</label>
              <select
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
              >
                <option value="Current">Current</option>
                <option value="Past">Past</option>
                <option value="Prospect">Prospect</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Lease start <span className="text-slate-500">(optional)</span>
              </label>
              <input
                type="date"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
                value={leaseStart}
                onChange={(e) => setLeaseStart(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Lease end <span className="text-slate-500">(optional)</span>
              </label>
              <input
                type="date"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
                value={leaseEnd}
                onChange={(e) => setLeaseEnd(e.target.value)}
              />
            </div>

            <div className="md:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-medium px-4 py-2 disabled:opacity-60"
              >
                {saving
                  ? editingId
                    ? 'Saving changes...'
                    : 'Saving...'
                  : editingId
                  ? 'Save changes'
                  : 'Save tenant'}
              </button>

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
          </form>
        </section>

        {/* LIST */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <h2 className="font-medium mb-4">Your tenants</h2>
          {loading ? (
            <p className="text-sm text-slate-400">Loading tenants...</p>
          ) : tenants.length === 0 ? (
            <p className="text-sm text-slate-400">No tenants yet. Add your first one above.</p>
          ) : (
            <div className="space-y-3">
              {tenants.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.email}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {t.status || 'Status unknown'} • Rent:{' '}
                      {t.monthly_rent ? `$${t.monthly_rent}` : 'N/A'}
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button
                      onClick={() => handleEditClick(t)}
                      className="rounded-full border border-slate-700 px-3 py-1 hover:bg-slate-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="rounded-full border border-red-600/70 px-3 py-1 text-red-200 hover:bg-red-900/40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
