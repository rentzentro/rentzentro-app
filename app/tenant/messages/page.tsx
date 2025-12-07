'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../supabaseClient';

type TenantRow = {
  id: number;
  name: string | null;
  email: string;
  user_id: string | null;
  owner_id: string | null; // landlord user_id
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

export default function TenantMessagesPage() {
  const router = useRouter();

  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [landlordUserId, setLandlordUserId] = useState<string | null>(null);

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
    if (msg.sender_type === 'tenant') return 'You';
    if (msg.sender_type === 'team') return 'Team member';
    return 'Landlord';
  };

  const isFromTenantSide = (msg: MessageRow) => msg.sender_type === 'tenant';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/tenant/login');
  };

  // ---------- Load tenant + landlord id ----------

  useEffect(() => {
    const load = async () => {
      setStatus('loading');
      setError(null);

      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError || !authData.user) {
          router.push('/tenant/login');
          return;
        }
        const user = authData.user;

        // 1) Try by user_id
        const { data: byUser, error: byUserError } = await supabase
          .from('tenants')
          .select('id, name, email, user_id, owner_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (byUserError) {
          console.error('Error loading tenant by user_id:', byUserError);
          throw new Error('Unable to load tenant account.');
        }

        let tenantRow = byUser as TenantRow | null;

        // 2) Fallback: match by email (older records)
        if (!tenantRow && user.email) {
          const { data: byEmail, error: byEmailError } = await supabase
            .from('tenants')
            .select('id, name, email, user_id, owner_id')
            .eq('email', user.email)
            .maybeSingle();

          if (byEmailError) {
            console.error('Error loading tenant by email:', byEmailError);
            throw new Error('Unable to load tenant account.');
          }

          tenantRow = byEmail as TenantRow | null;
        }

        if (!tenantRow) {
          throw new Error(
            'We could not find a tenant account for this login. Please contact your landlord.'
          );
        }

        setTenant(tenantRow);
        setLandlordUserId(tenantRow.owner_id);
        setStatus('ready');
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ||
            'Failed to load your tenant account. Please contact your landlord.'
        );
        setStatus('error');
      }
    };

    load();
  }, [router]);

  // ---------- Load messages ----------

  useEffect(() => {
    const loadMessages = async () => {
      if (!tenant) return;

      setLoadingMessages(true);
      setError(null);

      try {
        const { data: rows, error: messagesError } = await supabase
          .from('messages')
          .select(
            'id, landlord_id, landlord_user_id, tenant_id, tenant_user_id, body, sender_type, created_at, read_at'
          )
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: true });

        if (messagesError) {
          console.error('Error loading tenant messages:', messagesError);
          throw new Error('Unable to load your messages.');
        }

        const list = (rows || []) as MessageRow[];
        setMessages(list);

        // Mark landlord/team messages as read (tenant viewing)
        await supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .eq('tenant_id', tenant.id)
          .in('sender_type', ['landlord', 'team'])
          .is('read_at', null);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message || 'Failed to load your messages. Please try again.'
        );
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
  }, [tenant]);

  // ---------- Send message ----------

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!tenant || !landlordUserId) return;

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

      const insertPayload = {
        landlord_id: null, // optional; landlord_user_id is what RLS cares about
        landlord_user_id: landlordUserId,
        tenant_id: tenant.id,
        tenant_user_id: tenant.user_id,
        body,
        sender_type: 'tenant' as const,
      };

      const { data, error: insertError } = await supabase
        .from('messages')
        .insert(insertPayload)
        .select(
          'id, landlord_id, landlord_user_id, tenant_id, tenant_user_id, body, sender_type, created_at, read_at'
        )
        .single();

      if (insertError) {
        console.error('Error inserting tenant message:', insertError);
        throw new Error('Failed to send your message. Please try again.');
      }

      const newRow = data as MessageRow;
      setMessages((prev) => [...prev, newRow]);
      setNewMessage('');

      // Email notification to landlord/team can be added back here later.
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

  if (status === 'error' && !tenant) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-slate-900/80 border border-slate-700 p-6 shadow-xl space-y-4">
          <p className="text-sm text-red-400">
            {error ||
              'We could not find a tenant account for this login. Please contact your landlord.'}
          </p>
          <button
            onClick={() => router.push('/tenant/login')}
            className="rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
          >
            Back to tenant login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        {/* Header */}
        <header className="flex flex-col gap-3 border-b border-slate-900 pb-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs text-slate-500 flex gap-1 items-center">
              <Link href="/tenant/portal" className="hover:text-emerald-400">
                Tenant portal
              </Link>
              <span>/</span>
              <span className="text-slate-300">Messages</span>
            </div>
            <h1 className="mt-1 text-lg font-semibold text-slate-50">
              Messages with your landlord
            </h1>
            <p className="text-[11px] text-slate-400">
              Ask questions, share updates, or send photos to your landlord or
              their team. All messages stay in one place.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {tenant && (
              <div className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-[11px] text-slate-300">
                Signed in as{' '}
                <span className="font-medium">
                  {tenant.name || tenant.email}
                </span>
              </div>
            )}
            <Link
              href="/tenant/portal"
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800"
            >
              Back to portal
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

        {/* Conversation + composer */}
        <section className="rounded-2xl border border-slate-900 bg-slate-950/80 p-3 sm:p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Conversation
            </p>
            {loadingMessages && (
              <p className="text-[11px] text-slate-500">Loading messages…</p>
            )}
          </div>

          <div className="max-h-[420px] flex-1 overflow-y-auto rounded-2xl border border-slate-900 bg-slate-950/90 px-3 py-2 text-[11px] space-y-3">
            {messages.length === 0 ? (
              <p className="mt-6 text-center text-[11px] text-slate-500">
                No messages yet. Send a message to start the conversation.
              </p>
            ) : (
              messages.map((msg) => {
                const fromTenant = isFromTenantSide(msg);
                const label = labelForMessage(msg);
                return (
                  <div
                    key={msg.id}
                    className={`flex ${
                      fromTenant ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl border px-3 py-2 space-y-1 ${
                        fromTenant
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-50'
                          : 'border-slate-800 bg-slate-900/90 text-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-semibold">{label}</p>
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

          <form
            onSubmit={handleSendMessage}
            className="mt-3 flex flex-col gap-2 border-t border-slate-900 pt-3"
          >
            <label className="text-[11px] font-medium text-slate-300">
              New message
            </label>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Type your message to your landlord…"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] text-slate-500">
                Replies may come from your landlord or one of their team
                members. Team replies are labeled “Team member”.
              </p>
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-1.5 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sending ? 'Sending…' : 'Send message'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
