'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../supabaseClient';

type TenantRow = {
  id: number;
  name: string | null;
  email: string;
  owner_id: string | null; // landlord.user_id
  user_id: string | null;
};

type LandlordRow = {
  id: number;
  name: string | null;
  email: string;
  user_id: string;
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
  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);

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
      return tenant?.name || tenant?.email || 'You';
    }
    if (msg.sender_type === 'team') {
      return 'Team member';
    }
    // default: landlord
    return landlord?.name || landlord?.email || 'Landlord';
  };

  const isFromTenant = (msg: MessageRow) => msg.sender_type === 'tenant';

  // ---------- Load tenant + landlord + messages ----------

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

        // 1) Tenant for this logged-in user
        const { data: tenantRow, error: tenantError } = await supabase
          .from('tenants')
          .select('id, name, email, owner_id, user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (tenantError) {
          console.error('Error loading tenant row:', tenantError);
          throw new Error(
            'Something went wrong loading your tenant account. Please try again.'
          );
        }

        if (!tenantRow) {
          throw new Error(
            'We could not find a tenant account for this login. Please contact your landlord.'
          );
        }

        const tenantTyped = tenantRow as TenantRow;
        setTenant(tenantTyped);

        if (!tenantTyped.owner_id) {
          throw new Error(
            'We could not find the landlord for this rental. Please contact your landlord.'
          );
        }

        // 2) Landlord that owns this tenant (owner_id = landlord.user_id)
        const { data: landlordRow, error: landlordError } = await supabase
          .from('landlords')
          .select('id, name, email, user_id')
          .eq('user_id', tenantTyped.owner_id)
          .maybeSingle();

        if (landlordError) {
          console.error('Error loading landlord row:', landlordError);
          throw new Error(
            'We could not load your landlord account. Please contact your landlord.'
          );
        }

        if (!landlordRow) {
          throw new Error(
            'We could not find your landlord account in RentZentro. Please contact your landlord.'
          );
        }

        const landlordTyped = landlordRow as LandlordRow;
        setLandlord(landlordTyped);

        // 3) Messages for this tenant
        const { data: messageRows, error: messagesError } = await supabase
          .from('messages')
          .select(
            'id, landlord_id, landlord_user_id, tenant_id, tenant_user_id, body, sender_type, created_at, read_at'
          )
          .eq('tenant_id', tenantTyped.id)
          .order('created_at', { ascending: true });

        if (messagesError) {
          console.error('Error loading messages:', messagesError);
          throw new Error('Unable to load your message history.');
        }

        setMessages((messageRows || []) as MessageRow[]);
        setStatus('ready');
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ||
            'Something went wrong loading your messages. Please try again.'
        );
        setStatus('error');
      }
    };

    load();
  }, [router]);

  // ---------- Send message ----------

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!tenant || !landlord) return;

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

      const user = authData.user;

      const insertPayload = {
        landlord_id: landlord.id,
        landlord_user_id: landlord.user_id,
        tenant_id: tenant.id,
        tenant_user_id: user.id,
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

      // (Optional) Your existing email notification call can stay here.
      // If you already had a /api/tenant-message-email route before,
      // you can re-add that fetch right after a successful insert.
      //
      // Example (pseudo):
      // await fetch('/api/tenant-message-email', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ messageId: newRow.id }),
      // });
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
          <Link
            href="/tenant/login"
            className="inline-flex items-center justify-center rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
          >
            Back to tenant login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        {/* Header / breadcrumb */}
        <header className="flex flex-col gap-2 border-b border-slate-900 pb-3">
          <div className="text-xs text-slate-500 flex gap-1 items-center">
            <Link href="/tenant/portal" className="hover:text-emerald-400">
              Tenant portal
            </Link>
            <span>/</span>
            <span className="text-slate-300">Messages</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-semibold text-slate-50">
                Messages with your landlord
              </h1>
              <p className="text-[11px] text-slate-400">
                Ask questions, share updates, or follow up on maintenance
                requests. Your landlord and their team can reply here.
              </p>
            </div>
            {landlord && (
              <div className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-[11px] text-slate-300">
                Landlord:{' '}
                <span className="font-medium">
                  {landlord.name || landlord.email}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="rounded-xl border border-red-500/70 bg-red-500/10 px-4 py-2 text-sm text-red-100">
            {error}
          </div>
        )}

        {/* Conversation */}
        <section className="flex flex-1 flex-col rounded-2xl border border-slate-900 bg-slate-950/80 p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Conversation
            </p>
            <p className="text-[11px] text-slate-500">
              Messages are shared with your landlord and their team.
            </p>
          </div>

          <div className="flex-1 rounded-2xl border border-slate-900 bg-slate-950/80 px-3 py-2 text-[11px] max-h-[420px] overflow-y-auto space-y-3">
            {messages.length === 0 ? (
              <p className="mt-6 text-center text-[11px] text-slate-500">
                No messages yet. Send a message below to start the
                conversation.
              </p>
            ) : (
              messages.map((msg) => {
                const fromTenant = isFromTenant(msg);
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
                        <p className="text-[10px] font-semibold">
                          {fromTenant ? 'You' : label}
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
              New message
            </label>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Type your message for your landlord or their team…"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] text-slate-500">
                Your landlord and any approved team members can view and reply
                to messages here.
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
