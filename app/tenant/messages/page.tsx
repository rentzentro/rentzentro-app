'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';
import { ConversationPanel } from '../../components/ConversationPanel';

type TenantRow = {
  id: number;
  name: string | null;
  email: string;
  user_id: string | null;
  owner_id: string | null; // landlord auth UUID
};

type LandlordRow = {
  id: number;
  name: string | null;
  email: string;
  user_id: string | null; // landlord auth UUID
};

export default function TenantMessagesPage() {
  const router = useRouter();

  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const user = authData.user;
        if (!user) {
          router.push('/tenant/login');
          return;
        }

        // ---- Find tenant row for this logged-in user ----
        // Prefer a row with matching user_id; if none, fall back to matching email.
        const { data: tenantRows, error: tenantError } = await supabase
          .from('tenants')
          .select('id, name, email, user_id, owner_id')
          .or(`user_id.eq.${user.id},email.eq.${user.email}`)
          .order('created_at', { ascending: true });

        if (tenantError) throw tenantError;

        const t: TenantRow | null =
          tenantRows && tenantRows.length > 0
            ? (tenantRows.find((row: any) => row.user_id === user.id) ??
              tenantRows[0])
            : null;

        if (!t) {
          setTenant(null);
          setLandlord(null);
          setError(
            'We could not find a tenant profile linked to this account yet. ' +
              'This usually means your landlord has not added you with this email.'
          );
          return;
        }

        setTenant(t);

        if (!t.owner_id) {
          setLandlord(null);
          setError('No landlord is linked to this tenant account yet.');
          return;
        }

        // ---- Load landlord by owner_id (auth UUID) ----
        const { data: landlordRow, error: landlordError } = await supabase
          .from('landlords')
          .select('id, name, email, user_id')
          .eq('user_id', t.owner_id)
          .maybeSingle();

        if (landlordError) throw landlordError;
        if (!landlordRow) {
          setLandlord(null);
          setError('Landlord account not found for this tenant.');
          return;
        }

        setLandlord(landlordRow as LandlordRow);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to load messages.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/tenant/login');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading messages…</p>
      </main>
    );
  }

  if (!tenant || !landlord || !tenant.user_id || !landlord.user_id) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
        <div className="mx-auto max-w-md rounded-2xl border border-rose-500/60 bg-rose-950/40 p-4 text-xs text-rose-100 space-y-3">
          <p>
            {error ||
              'Messaging is not available yet because your tenant profile is not fully linked to your online portal account.'}
          </p>
          <button
            onClick={handleSignOut}
            className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-[11px] font-medium text-slate-100 hover:bg-slate-800"
          >
            Log out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6 lg:px-6">
        {/* Top shell */}
        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/tenant/portal"
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800"
            >
              ← Back to portal
            </Link>
            <h1 className="text-base font-semibold text-slate-50">
              Messages
            </h1>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs px-3 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
          >
            Log out
          </button>
        </header>

        {error && (
          <div className="mb-3 rounded-2xl border border-rose-500/50 bg-rose-950/40 px-4 py-2 text-xs text-rose-100">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
          <div className="mb-2 text-[11px] text-slate-300">
            You&apos;re messaging{' '}
            <span className="font-semibold">
              {landlord.name || landlord.email}
            </span>
            .
          </div>
          <ConversationPanel
            landlordId={landlord.id}
            landlordUserId={landlord.user_id!}
            tenantId={tenant.id}
            tenantUserId={tenant.user_id!}
            currentRole="tenant"
          />
        </section>
      </div>
    </main>
  );
}
