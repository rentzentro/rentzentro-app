'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../supabaseClient';
import { useRouter } from 'next/navigation';

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

export default function LandlordTenantsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [error, setError] = useState<string | null>(null);

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

        {/* 🔙 Back to dashboard */}
        <div>
          <Link
            href="/landlord"
            className="text-[11px] text-slate-500 hover:text-emerald-300"
          >
            ← Back to dashboard
          </Link>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-slate-50">
            Tenants
          </h1>
          <p className="text-slate-400 text-xs">
            Manage tenant info, leases, and communication.
          </p>
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
            No tenants found. Add a tenant from the properties page.
          </p>
        ) : (
          <div className="space-y-3">
            {tenants.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-100">
                    {t.name || 'Unnamed tenant'}
                  </p>
                  <p className="text-slate-400 text-xs">{t.email}</p>
                  <p className="text-slate-500 text-[11px]">
                    Rent: {t.monthly_rent ? `$${t.monthly_rent}` : 'N/A'}
                  </p>
                </div>

                <Link
                  href={`/landlord/tenants/${t.id}`}
                  className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                >
                  View / Edit
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
