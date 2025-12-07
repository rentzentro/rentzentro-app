'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

// ---------- Types ----------

type LandlordRow = {
  id: number;
  email: string;
  name: string | null;
  user_id: string | null;
};

type TeamMemberRow = {
  id: number;
  owner_user_id: string;
  member_user_id: string | null;
  member_email: string;
  role: string | null;
  status: string | null;
};

type TenantRow = {
  id: number;
  name: string | null;
  email: string | null;
  status: string | null;
  property_id: number | null;
};

type MessageRow = {
  id: string;
  landlord_id: number | null;
  landlord_user_id: string | null;
  tenant_id: number | null;
  tenant_user_id: string | null;
  body: string | null;
  sender_type: string | null;
  sender_label: string | null;
  created_at: string | null;
};

// ---------- Helpers ----------

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

// ---------- Component ----------

export default function LandlordMessagesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [teamMember, setTeamMember] = useState<TeamMemberRow | null>(null);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [ownerUuid, setOwnerUuid] = useState<string | null>(null); // landlord.user_id for scope

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<TenantRow | null>(null);

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // ---------- Load landlord scope (owner OR team) + tenants ----------

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          router.push('/landlord/login');
          return;
        }
        const user = authData.user;

        let landlordRow: LandlordRow | null = null;
        let tmRow: TeamMemberRow | null = null;
        let teamFlag = false;
        let scopeOwnerUuid: string | null = null;

        // 1) Try as direct landlord (owner)
        {
          const { data, error } = await supabase
            .from('landlords')
            .select('id, email, name, user_id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (error) {
            console.error('Error loading landlord by user_id:', error);
          } else if (data) {
            landlordRow = data as LandlordRow;
            scopeOwnerUuid = landlordRow.user_id || user.id;
          }
        }

        // 2) If not owner, try as ACTIVE team member
        if (!landlordRow) {
          const { data: tmData, error: tmError } = await supabase
            .from('landlord_team_members')
            .select(
              'id, owner_user_id, member_user_id, member_email, role, status'
            )
            .eq('member_user_id', user.id)
            .eq('status', 'active')
            .maybeSingle();

          if (tmError) {
            console.error('Error loading team member row:', tmError);
          }

          if (tmData) {
            tmRow = tmData as TeamMemberRow;
            teamFlag = true;
            scopeOwnerUuid = tmRow.owner_user_id || null;

            // Try to load the actual landlord row for display (but DO NOT hard-fail if missing)
            if (scopeOwnerUuid) {
              // First by user_id
              const { data: ownerByUser, error: ownerByUserError } =
                await supabase
                  .from('landlords')
                  .select('id, email, name, user_id')
                  .eq('user_id', scopeOwnerUuid)
                  .maybeSingle();

              if (!ownerByUserError && ownerByUser) {
                landlordRow = ownerByUser as LandlordRow;
              } else {
                // Fallback: some older data might have stored numeric owner IDs
                const { data: ownerById, error: ownerByIdError } =
                  await supabase
                    .from('landlords')
                    .select('id, email, name, user_id')
                    .eq('id', scopeOwnerUuid)
                    .maybeSingle();

                if (!ownerByIdError && ownerById) {
                  landlordRow = ownerById as LandlordRow;
                }
              }
            }
          }
        }

        if (!scopeOwnerUuid) {
          throw new Error(
            'Landlord account for this team owner could not be found.'
          );
        }

        setOwnerUuid(scopeOwnerUuid);
        setLandlord(landlordRow);
        setTeamMember(tmRow);
        setIsTeamMember(teamFlag);

        // 3) Load tenants for this landlord scope (by owner_id = landlord.user_id)
        const { data: tenantRows, error: tenantError } = await supabase
          .from('tenants')
          .select('id, name, email, status, property_id')
          .eq('owner_id', scopeOwnerUuid)
          .order('name', { ascending: true });

        if (tenantError) {
          console.error('Error loading tenants:', tenantError);
          throw new Error('Unable to load tenants for this landlord.');
        }

        setTenants((tenantRows || []) as TenantRow[]);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ||
            'Failed to load messages. Please refresh the page and try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  // ---------- Load messages when tenant selected ----------

  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedTenantId) {
        setMessages([]);
        setSelectedTenant(null);
        return;
      }

      setError(null);

      try {
        const tenant = tenants.find((t) => t.id === selectedTenantId) || null;
        setSelectedTenant(tenant || null);

        const { data, error } = await supabase
          .from('messages')
          .select(
            'id, landlord_id, landlord_user_id, tenant_id, tenant_user_id, body, sender_type, sender_label, created_at'
          )
          .eq('tenant_id', selectedTenantId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error loading messages:', error);
          throw new Error('Unable to load conversation.');
        }

        setMessages((data || []) as MessageRow[]);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ||
            'Failed to load conversation. Please try again in a moment.'
        );
      }
    };

    if (selectedTenantId) {
      loadMessages();
    }
  }, [selectedTenantId, tenants]);

  // ---------- Actions ----------

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/landlord/login');
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!ownerUuid || !selectedTenantId || !newMessage.trim()) return;

    const messageBody = newMessage.trim();
    setSending(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw new Error('You are not signed in. Please log in again.');
      }
      const user = authData.user;

      const senderType = isTeamMember ? 'team_member' : 'landlord';

      // Label shown to tenant: who replied
      let senderLabel: string | null = null;
      if (isTeamMember && teamMember) {
        const roleLabel =
          teamMember.role === 'viewer'
            ? 'Team member'
            : teamMember.role === 'manager'
            ? 'Manager'
            : 'Team member';
        senderLabel = `${
          teamMember.member_email || user.email || 'Team member'
        } (${roleLabel})`;
      } else {
        const baseName =
          landlord?.name || landlord?.email || user.email || 'Landlord';
        senderLabel = `${baseName} (Landlord)`;
      }

      // For owner path we keep landlord_id, for team path it's safe to be null.
      const landlordIdForInsert =
        !isTeamMember && landlord ? landlord.id : null;

      const insertPayload = {
        landlord_id: landlordIdForInsert,
        landlord_user_id: ownerUuid,
        tenant_id: selectedTenantId,
        tenant_user_id: null as string | null,
        body: messageBody,
        sender_type: senderType,
        sender_label: senderLabel,
      };

      const { data, error } = await supabase
        .from('messages')
        .insert(insertPayload)
        .select(
          'id, landlord_id, landlord_user_id, tenant_id, tenant_user_id, body, sender_type, sender_label, created_at'
        )
        .single();

      if (error) {
        console.error('Error sending message:', error);
        throw new Error('Failed to send message. Please try again.');
      }

      const inserted = data as MessageRow;
      setMessages((prev) => [...prev, inserted]);
      setNewMessage('');
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Something went wrong sending your message. Please try again.'
      );
    } finally {
      setSending(false);
    }
  };

  // ---------- UI ----------

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading messages…</p>
      </main>
    );
  }

  if (!ownerUuid) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-slate-900/80 border border-slate-700 p-6 shadow-xl space-y-4">
          <p className="text-sm text-red-400">
            {error ||
              'Landlord account for this team owner could not be found.'}
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

  const headerSubtitle = isTeamMember
    ? "You're logged in as a team member. Messages you send will appear to tenants with your name."
    : 'Send and receive messages with your tenants from a single inbox.';

  const signedInEmail = isTeamMember
    ? teamMember?.member_email || landlord?.email || 'Team member'
    : landlord?.email || 'Landlord';

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto flex min-h-[80vh] max-w-6xl flex-col gap-4">
        {/* Header */}
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs text-slate-500 flex gap-1 items-center">
              <Link href="/landlord" className="hover:text-emerald-400">
                Landlord
              </Link>
              <span>/</span>
              <span className="text-slate-300">Messages</span>
            </div>
            <h1 className="mt-1 text-xl font-semibold text-slate-50">
              Tenant messages
            </h1>
            <p className="text-[13px] text-slate-400">{headerSubtitle}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Signed in as{' '}
              <span className="font-medium text-slate-200">
                {signedInEmail}
              </span>
              {isTeamMember && landlord && (
                <>
                  {' · '}
                  <span className="text-emerald-300">
                    Team access for {landlord.email}
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <Link
              href="/landlord"
              className="text-xs px-4 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            >
              Back to dashboard
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs px-4 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Layout: tenants list + conversation */}
        <div className="flex flex-1 flex-col gap-4 md:flex-row">
          {/* Tenants list */}
          <aside className="md:w-64 lg:w-72 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Tenants
            </p>
            {tenants.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                You don&apos;t have any tenants yet. Add a tenant first, then
                you can message them here.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1 text-[11px]">
                {tenants.map((t) => {
                  const isActive = selectedTenantId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTenantId(t.id)}
                      className={`w-full rounded-xl border px-2.5 py-1.5 text-left transition ${
                        isActive
                          ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-50'
                          : 'border-slate-800 bg-slate-950/70 text-slate-100 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <p className="truncate text-[11px] font-medium">
                        {t.name || t.email || 'Unnamed tenant'}
                      </p>
                      {t.email && (
                        <p className="truncate text-[10px] text-slate-400">
                          {t.email}
                        </p>
                      )}
                      {t.status && (
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          Status: {t.status}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          {/* Conversation */}
          <section className="flex min-h-[380px] flex-1 flex-col rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
            {!selectedTenant ? (
              <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
                {tenants.length === 0
                  ? 'Add a tenant to start a conversation.'
                  : 'Select a tenant from the left to view your conversation.'}
              </div>
            ) : (
              <>
                {/* Conversation header */}
                <div className="mb-3 border-b border-slate-800 pb-2">
                  <p className="text-sm font-semibold text-slate-50">
                    {selectedTenant.name || selectedTenant.email || 'Tenant'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Messages between you (and your team) and this tenant.
                  </p>
                </div>

                {/* Messages list */}
                <div className="flex-1 space-y-2 overflow-y-auto pr-1 text-[11px]">
                  {messages.length === 0 ? (
                    <p className="mt-2 text-[11px] text-slate-500">
                      No messages yet. Send the first message below.
                    </p>
                  ) : (
                    messages.map((m) => {
                      const isFromTenant = (m.sender_type || '') === 'tenant';
                      const bubbleAlign = isFromTenant
                        ? 'items-start'
                        : 'items-end';
                      const bubbleClasses = isFromTenant
                        ? 'bg-slate-800/80 border-slate-700 text-slate-50'
                        : 'bg-emerald-500/15 border-emerald-500/50 text-emerald-50';

                      const label =
                        m.sender_type === 'tenant'
                          ? selectedTenant.name || selectedTenant.email || 'Tenant'
                          : m.sender_label ||
                            (m.sender_type === 'team_member'
                              ? 'Team member'
                              : 'Landlord');

                      return (
                        <div key={m.id} className={`flex ${bubbleAlign}`}>
                          <div
                            className={`max-w-[80%] rounded-2xl border px-3 py-2 ${bubbleClasses}`}
                          >
                            <div className="mb-0.5 flex items-center justify-between gap-3">
                              <span className="text-[10px] font-semibold">
                                {label}
                              </span>
                              {m.created_at && (
                                <span className="text-[9px] text-slate-400">
                                  {formatDateTime(m.created_at)}
                                </span>
                              )}
                            </div>
                            <p className="whitespace-pre-wrap text-[11px] leading-snug">
                              {m.body}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Composer */}
                <form onSubmit={handleSend} className="mt-3 border-t border-slate-800 pt-3">
                  <label className="mb-1 block text-[11px] font-medium text-slate-300">
                    Send a message
                  </label>
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Type your message to this tenant…"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-[10px] text-slate-500">
                      Tenants will see which team member replied in the
                      conversation.
                    </p>
                    <button
                      type="submit"
                      disabled={sending || !newMessage.trim()}
                      className="rounded-full bg-emerald-500 px-4 py-1.5 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sending ? 'Sending…' : 'Send message'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
