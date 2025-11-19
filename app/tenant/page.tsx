'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../supabaseClient';

type Tenant = {
  id: number;
  name: string;
  property_id: number | null;
  lease_start: string | null;
  lease_end: string | null;
  monthly_rent: number | null;
};

type Property = {
  id: number;
  name: string;
  unit_label: string | null;
};

export default function TenantPortal() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch tenant data based on logged-in user
  useEffect(() => {
    const loadTenantInfo = async () => {
      setLoading(true);
      setError(null);

      // 1) Check auth session
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        console.error(sessionError);
        setError('Error checking login.');
        setLoading(false);
        return;
      }

      const session = sessionData.session;

      if (!session) {
        router.push('/tenant/login');
        return;
      }

      const userEmail = session.user.email;

      // 2) Load tenant record matching email
      const { data: tenants, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('email', userEmail)
        .limit(1);

      if (tenantError) {
        console.error(tenantError);
        setError('Error loading tenant details.');
        setLoading(false);
        return;
      }

      if (!tenants || tenants.length === 0) {
        setError('No tenant account found for this email.');
        setLoading(false);
        return;
      }

      const t = tenants[0] as Tenant;
      setTenant(t);

      // 3) Load property info
      if (t.property_id) {
        const { data: properties, error: propError } = await supabase
          .from('properties')
          .select('*')
          .eq('id', t.property_id)
          .limit(1);

        if (propError) {
          console.error(propError);
        } else if (properties && properties.length > 0) {
          setProperty(properties[0] as Property);
        }
      }

      setLoading(false);
    };

    loadTenantInfo();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/tenant/login');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading your dashboard…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md space-y-4 text-center">
          <p className="text-red-400 text-sm">{error}</p>
          <Link
            href="/tenant/login"
            className="text-xs text-slate-300 underline"
          >
            Go back to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Tenant Portal</h1>
            <p className="text-xs text-slate-400 mt-1">
              Welcome, {tenant?.name || 'Tenant'}
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/"
              className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
            >
              Back to home
            </Link>

            <button
              onClick={handleLogout}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        </header>

        {/* Main Card */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200">
            Your rental details
          </h2>

          <div className="text-sm space-y-2">
            <p>
              <span className="text-slate-400">Property:</span>{' '}
              {property ? (
                <>
                  {property.name}
                  {property.unit_label && ` · ${property.unit_label}`}
                </>
              ) : (
                '—'
              )}
            </p>

            <p>
              <span className="text-slate-400">Monthly rent:</span>{' '}
              {tenant?.monthly_rent
                ? `$${tenant.monthly_rent.toLocaleString()}`
                : '—'}
            </p>

            <p>
              <span className="text-slate-400">Lease start:</span>{' '}
              {tenant?.lease_start
                ? new Date(tenant.lease_start).toLocaleDateString()
                : '—'}
            </p>

            <p>
              <span className="text-slate-400">Lease end:</span>{' '}
              {tenant?.lease_end
                ? new Date(tenant.lease_end).toLocaleDateString()
                : '—'}
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-500">
              Payment history and online payments coming soon.
            </p>
          </div>
        </section>

        {/* Maintenance requests */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200">
            Maintenance & requests
          </h2>
          <p className="text-xs text-slate-400">
            Need something repaired or noticed an issue in your unit? You can
            submit a maintenance request so your landlord can review and follow up.
          </p>

          <div>
            <Link
              href="/tenant/maintenance"
              className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800"
            >
              View / submit maintenance requests
            </Link>
          </div>

          <p className="text-[11px] text-slate-500">
            For emergencies (fire, gas leak, major water damage), contact local
            emergency services first, then notify your landlord.
          </p>
        </section>
      </div>
    </main>
  );
}
