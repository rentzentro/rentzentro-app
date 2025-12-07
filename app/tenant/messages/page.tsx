'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

type TenantRow = {
  id: number;
  name: string | null;
  email: string | null;
  user_id: string | null;
  owner_id: string | null; // landlord.user_id
};

type LandlordRow = {
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
  sender_type: string | null;
  sender_label: string | null;
  created_at: string | null;
};

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

export default function TenantMessagesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------- Load tenant + landlord + messages ----------

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          router.push('/tenant/login');
          return;
        }
        const user = authData.user;

        // 1) Find tenant (by user_id, fallback by email)
        let tenantRow: TenantRow | null = null;

        {
          const { data, error } = await supabase
            .from('tenants')
            .select('id, name, email, user_id, owner_id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (error) {
            console.error('Error loading tenant by user_id:', error);
            throw new Error('Unable to load your tenant account.');
          }
          if (data) tenantRow = data as TenantRow;
        }

        if (!tenantRow) {
          const { data, error } = await supabase
            .from('tenants')
            .select('id, name, email, user_id, owner_id')
            .eq('email', user.email)
            .maybeSingle();

          if (error) {
            console.error('Error loading tenant by email:', error);
            throw new Error('Unable to load your tenant account.');
          }
          if (data) tenantRow = data as TenantRow;
        }

        if (!tenantRow) {
          throw new Error(
            'We could not find a tenant profile for this login. Please contact your landlord.'
          );
        }

        if (!tenantRow.owner_id) {
          throw new Error(
            'Your landlord account could not be found. Please contact your landlord.'
          );
        }

        setTenant(tenantRow);

        // 2) Load landlord for this tenant (by owner_id = landlord.user_id)
        const { data: landlordRow, error: landlordError } = await supabase
          .from('landlords')
          .select('id, name, email, user_id')
          .eq('user_id', tenantRow.owner_id)
          .maybeSingle();

        if (landlordError) {
          console.error('Error loading landlord for tenant:', landlordError);
          throw new Error(
            'Your landlord account could not be found. Please contact your landlord.'
          );
        }

        if (!landlordRow) {
          throw new Error(
            'Your landlord account could not be found. Please contact your landlord.'
          );
        }

        const landlordTyped = landlordRow as LandlordRow;
        setLandlord(landlordTyped);

        // 3) Load existing messages for this tenant
        const { data: msgRows, error: msgError } = await supabase
          .from('messages')
          .select(
            'id, landlord_id, landlord_user_id, tenant_id, tenant_user_id, body, sender_type, sender_label, created_at'
          )
          .eq('tenant_id', tenantRow.id)
          .order('created_at', { ascending: true });

        if (msgError) {
          console.error('Error loading messages for tenant:', msgError);
          throw new Error('Unable to load your conversation.');
        }

        setMessages((msgRows || []) as MessageRow[]);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ||
            'Something went wrong loading your messages. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  // ---------- Actions ----------

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/tenant/login');
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!tenant || !landlord || !newMessage.trim()) return;

    const messageBody = newMessage.trim();
    setSending(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw new Error('You are not signed in. Please log in again.');
      }
      const user = authData.user;

      const insertPayload = {
        landlord_id: landlord.id,
        landlord_user_id: landlord.user_id,
        tenant_id: tenant.id,
        tenant_user_id: user.id,
        body: messageBody,
        sender_type: 'tenant',
        sender_label: null as string | null,
      };

      const { data, error } = await supabase
        .from('messages')
        .insert(insertPayload)
        .select(
          'id, landlord_id, landlord_user_id, tenant_id, tenant_user_id, body, sender_type, sender_label, created_at'
        )
        .single();

      if (error) {
        console.error('Error sending tenant message:', error);
        throw new Error('Failed to send your message. Please try again.');
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
        <p className="text-sm text-slate-400">Loading your messages…</p>
      </main>
    );
  }

  if (!tenant || !landlord) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-slate-900/80 border border-slate-700 p-6 shadow-xl space-y-4">
          <p className="text-sm text-red-400">
            {error ||
              'We could not find your tenant account. Please contact your landlord.'}
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
      <div className="mx-auto flex min-h-[80vh] max-w-4xl flex-col gap-4">
        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs text-slate-500 flex gap-1 items-center">
              <Link href="/tenant/portal" className="hover:text-emerald-400">
                Tenant
              </Link>
              <span>/</span>
              <span className="text-slate-300">Messages</span>
            </div>
            <h1 className="mt-1 text-xl font-semibold text-slate-50">
              Messages with your landlord
            </h1>
            <p className="text-[13px] text-slate-400">
              Ask questions, share updates, and keep all communication in one
              place.
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Your landlord:{' '}
              <span className="font-medium text-slate-200">
                {landlord.name || landlord.email}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="text-xs px-4 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 self-start"
          >
            Log out
          </button>
        </header>

        {error && (
          <div className="rounded-xl border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Conversation */}
        <section className="flex min-h-[380px] flex-1 flex-col rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          {/* Messages list */}
          <div className="mb-3 flex-1 space-y-2 overflow-y-auto pr-1 text-[11px]">
            {messages.length === 0 ? (
              <p className="mt-2 text-[11px] text-slate-500">
                No messages yet. Start the conversation below.
              </p>
            ) : (
              messages.map((m) => {
                const isFromTenant = (m.sender_type || '') === 'tenant';
                const bubbleAlign = isFromTenant ? 'items-end' : 'items-start';
                const bubbleClasses = isFromTenant
                  ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-50'
                  : 'bg-slate-800/80 border-slate-700 text-slate-50';

                let label: string;
                if (m.sender_type === 'tenant') {
                  label = 'You';
                } else if (m.sender_type === 'team_member') {
                  label = m.sender_label || 'Team member';
                } else {
                  // landlord
                  label =
                    m.sender_label ||
                    landlord.name ||
                    `${landlord.email} (Landlord)`;
                }

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
          <form onSubmit={handleSend} className="border-t border-slate-800 pt-3">
            <label className="mb-1 block text-[11px] font-medium text-slate-300">
              Send a message to your landlord
            </label>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Type your question or update…"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[10px] text-slate-500">
                Replies from your landlord or their team will show who you are
                talking with.
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
        </section>
      </div>
    </main>
  );
}
