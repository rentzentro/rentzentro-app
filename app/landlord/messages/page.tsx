'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../supabaseClient';

type LandlordRow = {
  id: number;
  name: string | null;
  email: string;
  user_id: string;
};

type TeamMemberRow = {
  id: number;
  owner_user_id: string;
  member_user_id: string | null;
  status: string | null;
};

type TenantRow = {
  id: number;
  name: string | null;
  email: string;
  user_id: string | null;
};

type MessageRow = {
  id: string;
  landlord_id: number | null;
  landlord_user_id: string | null;
  tenant_id: number | null;
  tenant_user_id: string | null;
  body: string | null;
  sender_type: 'landlord' | 'tenant' | 'team' | string | null;
  created_at: string;
  read_at: string | null;
};

type LoadStatus = 'loading' | 'ready' | 'error';

export default function LandlordMessagesPage() {
  const router = useRouter();

  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [isTeamMember, setIsTeamMember] = useState(false);

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  // ---------- Helpers ----------

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const labelForMessage = (msg: MessageRow): string => {
    if (msg.sender_type === 'tenant') {
      const t = tenants.find((x) => x.id === msg.tenant_id);
      return t?.name || t?.email || 'Tenant';
    }
    if (msg.sender_type === 'team') {
      return 'Team member';
    }
    return landlord?.name || landlord?.email || 'Landlord';
  };

  const isFromLandlordSide = (msg: MessageRow) =>
    msg.sender_type === 'landlord' || msg.sender_type === 'team';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/landlord/login');
  };

  // ---------- Load landlord / team / tenants ----------

  useEffect(() => {
    const load = async () => {
      setStatus('loading');
      setError(null);

      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError || !authData.user) {
          router.push('/landlord/login');
          return;
        }
        const user = authData.user;

        let resolvedLandlord: LandlordRow | null = null;
        let teamFlag = false;

        // 1) Try as owner landlord (user_id = auth user)
        const { data: landlordByUser, error: landlordUserError } =
          await supabase
            .from('landlords')
            .select('id, name, email, user_id')
            .eq('user_id', user.id)
            .maybeSingle();

        if (landlordUserError) {
          console.error('Error loading landlord by user_id:', landlordUserError);
          throw new Error('Unable to load landlord account.');
        }

        if (landlordByUser) {
          // Logged in as the owner
          resolvedLandlord = landlordByUser as LandlordRow;
          teamFlag = false;
        } else {
          // 2) Try as ACTIVE team member for some owner
          const { data: teamRow, error: teamError } = await supabase
            .from('landlord_team_members')
            .select('id, owner_user_id, member_user_id, status')
            .eq('member_user_id', user.id)
            .eq('status', 'active')
            .maybeSingle();

          if (teamError) {
            console.error('Error loading team membership:', teamError);
            throw new Error('Unable to load team membership.');
          }

          if (!teamRow) {
            throw new Error(
              'We could not find an active landlord account for this login.'
            );
          }

          const typedTeam = teamRow as TeamMemberRow;

          // 2a) Try to find the landlord row for this owner
          const { data: landlordOwner, error: landlordOwnerError } =
            await supabase
              .from('landlords')
              .select('id, name, email, user_id')
              .eq('user_id', typedTeam.owner_user_id)
              .maybeSingle();

          if (landlordOwnerError) {
            console.error(
              'Error loading owner landlord row for messages:',
              landlordOwnerError
            );
          }

          if (landlordOwner) {
            resolvedLandlord = landlordOwner as LandlordRow;
          } else {
            // Fallback: “virtual” landlord so messaging still works
            resolvedLandlord = {
              id: -1,
              name: null,
              email: 'Landlord account',
              user_id: typedTeam.owner_user_id,
            };
          }

          teamFlag = true;
        }

        if (!resolvedLandlord) {
          throw new Error('Landlord account could not be found.');
        }

        setLandlord(resolvedLandlord);
        setIsTeamMember(teamFlag);

        // 3) Load tenants for this landlord (owner id = landlord.user_id)
        const { data: tenantRows, error: tenantsError } = await supabase
          .from('tenants')
          .select('id, name, email, user_id')
          .eq('owner_id', resolvedLandlord.user_id)
          .order('name', { ascending: true });

        if (tenantsError) {
          console.error('Error loading tenants for landlord messages:', tenantsError);
          throw new Error('Unable to load your tenants for messaging.');
        }

        const tenantList = (tenantRows || []) as TenantRow[];
        setTenants(tenantList);

        if (tenantList.length > 0) {
          setSelectedTenantId(tenantList[0].id);
        }

        setStatus('ready');
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ||
            'Failed to load RentZentro messages. Please try again.'
        );
        setStatus('error');
      }
    };

    load();
  }, [router]);

  // ---------- Load messages for selected tenant ----------

  useEffect(() => {
    const loadMessages = async () => {
      if (!landlord || !selectedTenantId) return;

      setLoadingMessages(true);
      setError(null);

      try {
        const { data: rows, error: messagesError } = await supabase
          .from('messages')
          .select(
            'id, landlord_id, landlord_user_id, tenant_id, tenant_user_id, body, sender_type, created_at, read_at'
          )
          .eq('tenant_id', selectedTenantId)
          .order('created_at', { ascending: true });

        if (messagesError) {
          console.error('Error loading landlord messages:', messagesError);
          throw new Error('Unable to load messages for this tenant.');
        }

        const messageList = (rows || []) as MessageRow[];
        setMessages(messageList);

        // Mark tenant messages as read for this conversation (landlord/team viewing)
        await supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .eq('tenant_id', selectedTenantId)
          .eq('sender_type', 'tenant')
          .is('read_at', null);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ||
            'Failed to load messages for this tenant. Please try again.'
        );
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
  }, [landlord, selectedTenantId]);

  // ---------- Send message ----------

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!landlord || !selectedTenantId) return;

    const body = newMessage.trim();
    if (!body) return;

    setSending(true);
    setError(null);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw new Error('Please log in again to send a message.');
      }

      const tenant = tenants.find((t) => t.id === selectedTenantId);
      if (!tenant) throw new Error('Tenant not found for this conversation.');

      const insertPayload = {
        landlord_id: landlord.id > 0 ? landlord.id : null,
        landlord_user_id: landlord.user_id,
        tenant_id: tenant.id,
        tenant_user_id: tenant.user_id,
        body,
        sender_type: (isTeamMember ? 'team' : 'landlord') as
          | 'team'
          | 'landlord',
      };

      const { data, error: insertError } = await supabase
        .from('messages')
        .insert(insertPayload)
        .select(
          'id, landlord_id, landlord_user_id, tenant_id, tenant_user_id, body, sender_type, created_at, read_at'
        )
        .single();

      if (insertError) {
        console.error('Error inserting landlord/team message:', insertError);
        throw new Error('Failed to send your message. Please try again.');
      }

      const newRow = data as MessageRow;
      setMessages((prev) => [...prev, newRow]);
      setNewMessage('');

      // Email notifications can be wired back in here later if needed.
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Failed to send your message. Please double-check and try again.'
      );
    } finally {
      setSending(false);
    }
  };

  // ---------- UI ----------

  if (status === 'loading') {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading messages…</p>
      </main>
    );
  }

  if (status === 'error' && !landlord) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-slate-900/80 border border-slate-700 p-6 shadow-xl space-y-4">
          <p className="text-sm text-red-400">
            {error || 'Landlord account could not be found.'}
          </p>
          <button
            onClick={() => router.push('/landlord/login')}
            className="rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
          >
            Back to login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        {/* Header */}
        <header className="flex flex-col gap-3 border-b border-slate-900 pb-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs text-slate-500 flex gap-1 items-center">
              <Link href="/landlord" className="hover:text-emerald-400">
                Landlord dashboard
              </Link>
              <span>/</span>
              <span className="text-slate-300">Messages</span>
            </div>
            <h1 className="mt-1 text-lg font-semibold text-slate-50">
              Messages with tenants
            </h1>
            <p className="text-[11px] text-slate-400">
              View and reply to messages from your tenants. Team members share
              the same inbox and can reply on your behalf.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {landlord && (
              <div className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-[11px] text-slate-300">
                {isTeamMember ? 'Team member for ' : 'Signed in as '}{' '}
                <span className="font-medium">
                  {landlord.name || landlord.email}
                </span>
              </div>
            )}
            <Link
              href="/landlord"
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800"
            >
              Back to dashboard
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="rounded-xl border border-red-500/70 bg-red-500/10 px-4 py-2 text-sm text-red-100">
            {error}
          </div>
        )}

        <section className="flex flex-col gap-4 rounded-2xl border border-slate-900 bg-slate-950/80 p-3 sm:p-4">
          {/* Tenant selector */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Tenant conversations
              </p>
              <p className="text-[11px] text-slate-500">
                Choose a tenant to see your message history.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Tenant:</span>
              <select
                value={selectedTenantId ?? ''}
                onChange={(e) =>
                  setSelectedTenantId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {tenants.length === 0 && (
                  <option value="">No tenants yet</option>
                )}
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name || t.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Conversation */}
          <div className="rounded-2xl border border-slate-900 bg-slate-950/80 p-3 sm:p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Conversation
              </p>
              {loadingMessages && (
                <p className="text-[11px] text-slate-500">
                  Loading messages…
                </p>
              )}
            </div>

            <div className="max-h-[420px] flex-1 overflow-y-auto rounded-2xl border border-slate-900 bg-slate-950/90 px-3 py-2 text-[11px] space-y-3">
              {!selectedTenantId ? (
                <p className="mt-6 text-center text-[11px] text-slate-500">
                  Select a tenant to view messages.
                </p>
              ) : messages.length === 0 ? (
                <p className="mt-6 text-center text-[11px] text-slate-500">
                  No messages yet for this tenant.
                </p>
              ) : (
                messages.map((msg) => {
                  const fromLandlordSide = isFromLandlordSide(msg);
                  const label = labelForMessage(msg);
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${
                        fromLandlordSide ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl border px-3 py-2 space-y-1 ${
                          fromLandlordSide
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-50'
                            : 'border-slate-800 bg-slate-900/90 text-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-semibold">
                            {label}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                        <p className="whitespace-pre-wrap text-[11px]">
                          {msg.body}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Composer */}
            <form
              onSubmit={handleSendMessage}
              className="mt-3 flex flex-col gap-2 border-t border-slate-900 pt-3"
            >
              <label className="text-[11px] font-medium text-slate-300">
                New message to tenant
              </label>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder={
                  selectedTenantId
                    ? 'Type your message to this tenant…'
                    : 'Select a tenant to start messaging…'
                }
                disabled={!selectedTenantId}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] text-slate-500">
                  Messages are shared with your tenant. Team members are labeled
                  as “Team member” on the tenant side.
                </p>
                <button
                  type="submit"
                  disabled={
                    sending || !selectedTenantId || !newMessage.trim()
                  }
                  className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-1.5 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sending ? 'Sending…' : 'Send message'}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
