'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

// ---------- Types ----------
type TenantRow = {
  id: number;
  name: string | null;
  email: string;
  phone: string | null;
  status: string | null;
  property_id: number | null;
  monthly_rent: number | null;
  lease_start: string | null;
  lease_end: string | null;
};

// ---------- Helpers ----------
const formatCurrency = (v: number | null | undefined) =>
  v == null || isNaN(v)
    ? 'N/A'
    : v.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
      });

export default function LandlordTenantsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load tenants for this landlord (RLS enforces ownership)
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: tError } = await supabase
          .from('tenants')
          .select('*')
          .order('created_at', { ascending: false });

        if (tError) throw tError;

        setTenants((data || []) as TenantRow[]);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to load tenants.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleDeleteTenant = async (id: number) => {
    const confirmed = window.confirm(
      'Delete this tenant? This cannot be undone.'
    );
    if (!confirmed) return;

    setError(null);

    try {
      const { error: delError } = await supabase
        .from('tenants')
        .delete()
        .eq('id', id);

      if (delError) throw delError;

      setTenants((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to delete tenant.');
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Loading tenants…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Back to dashboard */}
        <div>
          <Link
            href="/landlord"
            className="text-[11px] text-slate-500 hover:text-emerald-300"
          >
            ← Back to dashboard
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-50">Tenants</h1>
            <p className="text-slate-400 text-xs">
              Manage tenant details, leases, and login access.
            </p>
          </div>
          <Link
            href="/landlord/properties"
            className="rounded-full border border-emerald-600 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
          >
            + Add tenant (via property)
          </Link>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Tenant list */}
        {tenants.length === 0 ? (
          <p className="text-slate-500 text-sm">
            No tenants found yet. Add tenants from your properties or use the
            &quot;Add tenant&quot; button.
          </p>
        ) : (
          <div className="space-y-3">
            {tenants.map((t) => (
              <div
                key={t.id}
                className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-100">
                    {t.name || 'Unnamed tenant'}
                  </p>
                  <p className="text-slate-400 text-xs">{t.email}</p>
                  {t.phone && (
                    <p className="text-slate-500 text-[11px]">
                      Phone: {t.phone}
                    </p>
                  )}
                  <p className="text-slate-500 text-[11px]">
                    Status:{' '}
                    <span className="text-slate-200">
                      {t.status || 'Not set'}
                    </span>
                    {' • '}
                    Rent:{' '}
                    <span className="text-slate-200">
                      {formatCurrency(t.monthly_rent)}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2 md:justify-end">
                  <Link
                    href={`/landlord/tenants/${t.id}`}
                    className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    View / Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDeleteTenant(t.id)}
                    className="rounded-full border border-rose-600 bg-rose-900/60 px-3 py-1.5 text-xs text-rose-100 hover:bg-rose-800"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
