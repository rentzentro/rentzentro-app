'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';
import { ConversationPanel } from '../../components/ConversationPanel';

// ---------- Types ----------

type LandlordRow = {
  id: number;
  email: string;
  name: string | null;
  user_id: string | null; // auth UID
};

type TenantRow = {
  id: number;
  owner_id: string | null;
  name: string | null;
  email: string;
  user_id: string | null; // tenant's auth UID when they have portal access
};

// ---------- Page ----------

export default function LandlordMessagesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantRow | null>(null);
  const [unreadByTenant, setUnreadByTenant] = useState<Record<string, number>>(
    {}
  );
  const [error, setError] = useState<string | null>(null);

  // ---------- Load landlord + tenants + unread counts ----------

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        // Auth user
        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError) throw authError;

        const email = authData.user?.email;
        const authUserId = authData.user?.id;
        if (!email || !authUserId) {
          throw new Error('Unable to load landlord account. Please log in again.');
        }

        // Landlord row
        const { data: landlordRow, error: landlordError } = await supabase
          .from('landlords')
          .select('id, email, name, user_id')
          .eq('email', email)
          .maybeSingle();

        if (landlordError) throw landlordError;
        if (!landlordRow) {
          throw new Error(
            'Landlord record not found for this account. Please contact support if this seems wrong.'
          );
        }

        const landlordTyped = landlordRow as LandlordRow;
        // Defensive: if user_id is null, backfill from auth
        if (!landlordTyped.user_id) {
          const { data: updated, error: updateError } = await supabase
            .from('landlords')
            .update({ user_id: authUserId })
            .eq('id', landlordTyped.id)
            .select('id, email, name, user_id')
            .maybeSingle();

          if (updateError) {
            console.error('Failed to backfill landlord.user_id:', updateError);
          } else if (updated) {
            landlordTyped.user_id = (updated as LandlordRow).user_id;
          }
        }

        setLandlord(landlordTyped);

        // Tenants for this landlord
        const { data: tenantRows, error: tenantError } = await supabase
          .from('tenants')
          .select('id, owner_id, name, email, user_id')
          .eq('owner_id', landlordTyped.user_id)
          .order('created_at', { ascending: true });

        if (tenantError) throw tenantError;

        const tenantList = (tenantRows || []) as TenantRow[];
        setTenants(tenantList);

        // Unread messages per tenant (tenant -> landlord)
        if (landlordTyped.user_id) {
          const { data: unreadRows, error: unreadError } = await supabase
            .from('messages')
            .select('tenant_user_id')
            .eq('landlord_user_id', landlordTyped.user_id)
            .eq('sender_type', 'tenant')
            .is('read_at', null);

          if (unreadError) {
            console.error('Unread-by-tenant query error:', unreadError);
          } else {
            const counts: Record<string, number> = {};
            (unreadRows || []).forEach((row: any) => {
              const key = row.tenant_user_id as string | null;
              if (!key) return;
              counts[key] = (counts[key] || 0) + 1;
            });
            setUnreadByTenant(counts);
          }
        } else {
          setUnreadByTenant({});
        }

        // Default selection: first tenant with unread, otherwise first tenant
        if (tenantList.length > 0) {
          const tenantWithUnread =
            tenantList.find(
              (t) => t.user_id && unreadByTenant[t.user_id] && unreadByTenant[t.user_id] > 0
            ) || tenantList[0];

          setSelectedTenant(tenantWithUnread);
        } else {
          setSelectedTenant(null);
        }
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ||
            'Failed to load messages. Please refresh the page or try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Actions ----------

  const handleBack = () => {
    router.push('/landlord/dashboard');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/landlord/login');
  };

  // ---------- Render ----------

  if (loading && !landlord) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading messages…</p>
      </main>
    );
  }

  if (!landlord) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-slate-900/80 border border-red-500/60 p-6 space-y-4">
          <p className="text-sm text-red-200">
            {error ||
              'We could not find a landlord record for this account. Please contact support.'}
          </p>
          <button
            onClick={handleSignOut}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
          >
            Back to login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-4">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <button
              type="button"
              onClick={handleBack}
              className="text-[11px] text-slate-500 hover:text-emerald-300"
            >
              ← Back to dashboard
            </button>
            <h1 className="text-lg font-semibold text-slate-50">Messages</h1>
            <p className="text-[11px] text-slate-400">
              Send and receive messages with your tenants.
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800"
          >
            Log out
          </button>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-500/60 bg-rose-950/40 px-4 py-2 text-sm text-rose-100">
            {error}
          </div>
        )}

        {/* Main layout */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
          {/* Tenant list */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Tenants
            </p>

            {tenants.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                You don&apos;t have any tenants yet. Add a tenant first, then invite
                them to the portal to start messaging.
              </p>
            ) : (
              <div className="space-y-2">
                {tenants.map((t) => {
                  const isSelected = selectedTenant?.id === t.id;
                  const unreadCount =
                    t.user_id && unreadByTenant[t.user_id]
                      ? unreadByTenant[t.user_id]
                      : 0;

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTenant(t)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition
                        ${
                          isSelected
                            ? 'border-emerald-500/70 bg-emerald-500/15 text-emerald-100'
                            : 'border-slate-800 bg-slate-950/60 text-slate-100 hover:bg-slate-900'
                        }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {t.name || 'Unnamed tenant'}
                        </p>
                        <p className="truncate text-[11px] text-slate-400">
                          {t.email}
                        </p>
                      </div>
                      {unreadCount > 0 && (
                        <span className="ml-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-slate-950">
                          {unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Conversation */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
            {!selectedTenant ? (
              <div className="flex h-64 items-center justify-center text-xs text-slate-500">
                Select a tenant on the left to view your conversation.
              </div>
            ) : !selectedTenant.user_id ? (
              <div className="flex h-64 items-center justify-center px-4">
                <div className="rounded-2xl border border-amber-500/60 bg-amber-950/30 px-4 py-3 text-center text-[11px] text-amber-100 max-w-sm">
                  <p className="font-semibold mb-1">
                    This tenant doesn&apos;t have a linked portal account yet.
                  </p>
                  <p>
                    Messaging becomes available after they accept their invite and
                    create a tenant portal login using this email:
                    <br />
                    <span className="font-mono text-[10px] text-amber-200">
                      {selectedTenant.email}
                    </span>
                  </p>
                </div>
              </div>
            ) : (
              <ConversationPanel
                landlordId={landlord.id}
                landlordUserId={landlord.user_id as string}
                tenantId={selectedTenant.id}
                tenantUserId={selectedTenant.user_id}
                currentRole="landlord"
              />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
