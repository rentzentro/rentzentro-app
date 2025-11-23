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
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export default function LandlordPropertiesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [properties, setProperties] = useState<PropertyRow[]>([]);

  const [name, setName] = useState('');
  const [unitLabel, setUnitLabel] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [status, setStatus] = useState<'current' | 'vacant' | 'off-market'>(
    'current'
  );
  const [nextDueDate, setNextDueDate] = useState('');

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
        const { data, error: propError } = await supabase
          .from('properties')
          .select('*')
          .eq('owner_id', uid)
          .order('created_at', { ascending: true });

        if (propError) throw propError;

        setProperties((data || []) as PropertyRow[]);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to load properties.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/landlord/login');
  };

  const reloadProperties = async (uid: string) => {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('owner_id', uid)
      .order('created_at', { ascending: true });

    if (error) throw error;
    setProperties((data || []) as PropertyRow[]);
  };

  const handleCreateProperty = async () => {
    if (!userId) {
      setError('Missing landlord account. Please log in again.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: insertError } = await supabase.from('properties').insert({
        name: name || null,
        unit_label: unitLabel || null,
        monthly_rent: monthlyRent ? Number(monthlyRent) : null,
        status,
        next_due_date: nextDueDate || null,
        owner_id: userId, // 🔑 matches RLS
        landlord_email: userEmail,
      });

      if (insertError) {
        console.error('Insert property error:', insertError);
        setError(insertError.message || 'Failed to create property.');
        return;
      }

      setSuccess('Property created.');
      setName('');
      setUnitLabel('');
      setMonthlyRent('');
      setStatus('current');
      setNextDueDate('');

      await reloadProperties(userId);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unexpected error creating property.');
      return;
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProperty = async (propertyId: number) => {
    if (!userId) return;

    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', propertyId)
        .eq('owner_id', userId);

      if (error) {
        console.error('Delete property error:', error);
        setError(
          error.message ||
            'Failed to delete property (check tenants/payments linked).'
        );
        return;
      }

      setSuccess('Property deleted.');
      await reloadProperties(userId);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unexpected error deleting property.');
    }
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
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
              Add and manage the units you collect rent for.
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
          {/* Left: list */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  Your properties
                </p>
                <p className="mt-1 text-sm font-medium text-slate-50">
                  {properties.length} unit
                  {properties.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            {properties.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
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
                        {p.name || 'Property'}{' '}
                        {p.unit_label ? `· ${p.unit_label}` : ''}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Status:{' '}
                        <span className="text-slate-200">
                          {p.status || 'Unknown'}
                        </span>{' '}
                        • Rent:{' '}
                        <span className="text-slate-200">
                          {formatCurrency(p.monthly_rent)}
                        </span>
                      </p>
                      {p.next_due_date && (
                        <p className="text-[11px] text-slate-500">
                          Next due: {formatDate(p.next_due_date)}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteProperty(p.id)}
                      className="text-[11px] px-2 py-1 rounded-full border border-rose-500/60 text-rose-200 hover:bg-rose-950/40"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: add property */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Add property
            </p>
            <p className="text-[13px] text-slate-400">
              Create a unit and set its rent and next due date.
            </p>

            <div className="space-y-2 text-xs">
              <div className="space-y-1">
                <label className="block text-slate-400">Property name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                  placeholder="123 Main St"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400">Unit / label</label>
                <input
                  value={unitLabel}
                  onChange={(e) => setUnitLabel(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                  placeholder="Apt 2B"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-slate-400">Monthly rent</label>
                  <input
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                    placeholder="1500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-400">Status</label>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(
                        e.target.value as 'current' | 'vacant' | 'off-market'
                      )
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                  >
                    <option value="current">Current</option>
                    <option value="vacant">Vacant</option>
                    <option value="off-market">Off market</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400">Next due date</label>
                <input
                  type="date"
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="button"
                onClick={handleCreateProperty}
                disabled={saving}
                className="mt-3 w-full rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {saving ? 'Creating…' : 'Create property'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
