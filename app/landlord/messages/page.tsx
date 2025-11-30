'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';
import { ConversationPanel } from '../../components/ConversationPanel';

type LandlordRow = {
  id: number;
  email: string;
  name: string | null;
  user_id: string | null; // auth.users UUID
};

type TenantRow = {
  id: number;
  name: string | null;
  email: string;
  user_id: string | null; // auth.users UUID
};

export default function LandlordMessagesPage() {
  const router = useRouter();

  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
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
          router.push('/landlord/login');
          return;
        }

        // Landlord row for this auth user
        const { data: landlordRow, error: landlordError } = await supabase
          .from('landlords')
          .select('id, email, name, user_id')
          .eq('user_id', user.id)
          .single();

        if (landlordError || !landlordRow) {
          throw landlordError || new Error('Landlord account not found.');
        }

        setLandlord(landlordRow as LandlordRow);

        // Tenants whose owner_id = this landlord's auth user id
        const { data: tenantsRows, error: tenantsError } = await supabase
          .from('tenants')
          .select('id, name, email, user_id, owner_id')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: true });

        if (tenantsError) throw tenantsError;

        const castTenants: TenantRow[] = (tenantsRows || []).map((t: any) => ({
          id: t.id as number,
          name: t.name as string | null,
          email: t.email as string,
          user_id: t.user_id as string | null,
        }));

        setTenants(castTenants);
        if (castTenants.length > 0) {
          setSelectedTenantId(castTenants[0].id);
        }
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
    router.push('/landlord/login');
  };

  const selectedTenant =
    tenants.find((t) => t.id === selectedTenantId) || null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 lg:px-6">
        {/* Top shell */}
        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/landlord"
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800"
            >
              ← Back to dashboard
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

        {loading && (
          <div className="text-xs text-slate-400">Loading…</div>
        )}

        {!loading && landlord && tenants.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-4 text-xs text-slate-200">
            You don&apos;t have any tenants yet, so there&apos;s no one to
            message. Once you add tenants, you can chat with them from here.
          </div>
        )}

        {!loading && landlord && tenants.length > 0 && (
          <div className="grid gap-4 md:grid-cols-[220px,minmax(0,1fr)]">
            {/* Left column: tenant list */}
            <aside className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-3 text-xs">
              <p className="mb-1 text-[11px] font-semibold text-slate-200">
                Tenants
              </p>
              <div className="space-y-1">
                {tenants.map((t) => {
                  const isActive = t.id === selectedTenantId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTenantId(t.id)}
                      className={
                        'w-full rounded-xl px-3 py-2 text-left ' +
                        (isActive
                          ? 'bg-emerald-500/20 border border-emerald-500/60 text-emerald-50'
                          : 'bg-slate-950/60 border border-slate-800 text-slate-200 hover:bg-slate-900')
                      }
                    >
                      <div className="text-xs font-medium">
                        {t.name || t.email}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {t.email}
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Right column: conversation */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
              {selectedTenant &&
              landlord.user_id &&
              selectedTenant.user_id ? (
                <ConversationPanel
                  landlordId={landlord.id}
                  landlordUserId={landlord.user_id}
                  tenantId={selectedTenant.id}
                  tenantUserId={selectedTenant.user_id}
                  currentRole="landlord"
                />
              ) : (
                <div className="text-xs text-slate-400">
                  This tenant doesn&apos;t have a linked portal account yet, so
                  messaging isn&apos;t available.
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
