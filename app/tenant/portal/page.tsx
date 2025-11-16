'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

type TenantRow = {
  id: number;
  name: string;
  email: string;
  property_id: number | null;
  monthly_rent: number | null;
  status: string | null;
  lease_start: string | null;
  lease_end: string | null;
};

export default function TenantPortalPage() {
  const router = useRouter();
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error(error);
        setError(error.message);
        setLoading(false);
        return;
      }

      if (!session?.user) {
        router.push('/tenant/login');
        return;
      }

      const email = session.user.email?.toLowerCase();

      const { data, error: qError } = await supabase
        .from('tenants')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (qError) {
        console.error(qError);
        setError(qError.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setError(
          'No tenant account found for this email. Please ask your landlord to add you to RentZentro.'
        );
      } else {
        setTenant(data);
        setError(null);
      }

      setLoading(false);
    };

    load();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="text-xs text-slate-400 hover:text-slate-200">
            ← Back to home
          </Link>
          <button
            onClick={handleLogout}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Log out
          </button>
        </header>

        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h1 className="text-xl font-semibold">Tenant portal</h1>
          <p className="text-xs text-slate-400">
            View your unit, rent amount, and lease dates. Online payments coming soon.
          </p>

          {loading && <p className="text-sm text-slate-400">Loading your info...</p>}

          {!loading && error && (
            <div className="rounded-xl bg-red-900/40 border border-red-500/60 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          {!loading && tenant && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-slate-400 text-xs mb-1">Name</p>
                <p className="font-medium">{tenant.name}</p>
              </div>

              <div>
                <p className="text-slate-400 text-xs mb-1">Email</p>
                <p>{tenant.email}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-400 text-xs mb-1">Monthly rent</p>
                  <p>{tenant.monthly_rent ? `$${tenant.monthly_rent}` : 'Not set'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-1">Status</p>
                  <p>{tenant.status || 'Current'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-400 text-xs mb-1">Lease start</p>
                  <p>{tenant.lease_start || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-1">Lease end</p>
                  <p>{tenant.lease_end || 'Not set'}</p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
