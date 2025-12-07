// app/tenant/messages/page.tsx
'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

// ---------- Types ----------

type TenantRow = {
  id: number;
  name: string | null;
  email: string;
  owner_id: string | null; // landlord user's UUID
};

type LandlordRow = {
  id: number;
  user_id: string;
  name: string | null;
  email: string;
};

type MessageRow = {
  id: string;
  landlord_id: number;
  landlord_user_id: string | null;
  tenant_id: number;
  tenant_user_id: string | null;
  body: string;
  sender_type: 'tenant' | 'landlord' | 'team';
  sender_label: string | null;
  created_at: string;
  read_at: string | null;
};

// ---------- Helpers ----------

const formatTimestamp = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

// ---------- Page ----------

export default function TenantMessagesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [newMessage, setNewMessage] = useState('');

  // ---------- Load tenant, landlord, messages ----------

  useEffect(() => {
    const loadThread = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1) Auth user must be a tenant
        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError || !authData.user) {
          router.push('/tenant/login');
          return;
        }
        const user = authData.user;
        const userEmail = user.email || '';

        // 2) Find tenant row for this user
        let tenantTyped: TenantRow | null = null;

        // 2a) Primary: match by user_id
        const {
          data: tenantByUser,
          error: tenantByUserError,
        } = await supabase
          .from('tenants')
          .select('id, name, email, owner_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (tenantByUserError) {
          console.error('Error loading tenant by user_id:', tenantByUserError);
        }

        if (tenantByUser) {
          tenantTyped = tenantByUser as TenantRow;
        } else if (userEmail) {
          // 2b) Fallback: match by email (covers cases where user_id is null)
          const {
            data: tenantByEmail,
            error: tenantByEmailError,
          } = await supabase
            .from('tenants')
            .select('id, name, email, owner_id')
            .eq('email', userEmail)
            .maybeSingle();

          if (tenantByEmailError) {
            console.error('Error loading tenant by email:', tenantByEmailError);
          }

          if (tenantByEmail) {
            tenantTyped = tenantByEmail as TenantRow;
          }
        }

        if (!tenantTyped) {
          throw new Error(
            'We could not find a tenant account for this login. Please contact your landlord.'
          );
        }

        setTenant(tenantTyped);

        if (!tenantTyped.owner_id) {
          throw new Error(
            'Your tenant record is missing landlord information. Please contact your landlord.'
          );
        }

        // 3) Try to load landlord row. If RLS blocks it, we fallback.
        let landlordTyped: LandlordRow | null = null;

        try {
          const {
            data: landlordRow,
            error: landlordError,
          } = await supabase
            .from('landlords')
            .select('id, user_id, name, email')
            .eq('user_id', tenantTyped.owner_id)
            .maybeSingle();

          if (!landlordError && landlordRow) {
            landlordTyped = landlordRow as LandlordRow;
          } else {
            console.warn('Tenant cannot read landlord row, using fallback shell.');
          }
        } catch {
          console.warn('Tenant blocked from landlord table — fallback is required.');
        }

        // Fallback landlord shell — messaging still works
        if (!landlordTyped) {
          landlordTyped = {
            id: -1, // synthetic
            user_id: tenantTyped.owner_id,
            name: null,
            email: 'Your landlord',
          };
        }

        setLandlord(landlordTyped);

        // 4) Load existing messages
        const {
          data: messagesData,
          error: messagesError,
        } = await supabase
          .from('messages')
          .select(
            'id, landlord_id, landlord_user_id, tenant_id, tenant_user_id, body, sender_type, sender_label, created_at, read_at'
          )
          .eq('tenant_id', tenantTyped.id)
          .order('created_at', { ascending: true });

        if (messagesError) {
          console.error('Error loading messages:', messagesError);
          throw new Error(
            'We had trouble loading your message history. Please try again.'
          );
        }

        setMessages((messagesData || []) as MessageRow[]);

        // 5) Mark messages as read
        try {
          await supabase
            .from('messages')
            .update({ read_at: new Date().toISOString() })
            .eq('tenant_id', tenantTyped.id)
            .eq('tenant_user_id', user.id)
            .is('read_at', null)
            .in('sender_type', ['landlord', 'team']);
        } catch (markErr) {
          console.warn('Error marking messages as read (tenant):', markErr);
        }
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

    loadThread();
  }, [router]);

  // ---------- Actions ----------

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/tenant/login');
  };

  const handleBackToDashboard = () => {
    router.push('/tenant/portal');
  };

  const handleSend = async (e: FormEvent) => {
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
        throw new Error('Please log in again and resend your message.');
      }
      const user = authData.user;

      const senderLabel = `${
        tenant.name || tenant.email || user.email || 'You'
      } (Tenant)`;

      const insertPayload = {
        landlord_id: landlord.id,
        landlord_user_id: landlord.user_id,
        tenant_id: tenant.id,
        tenant_user_id: user.id,
        body,
        sender_type: 'tenant' as const,
        sender_label: senderLabel,
      };

      const {
        data: inserted,
        error: insertError,
      } = await supabase
        .from('messages')
        .insert(insertPayload)
        .select(
          'id, landlord_id, landlord_user_id, tenant_id, tenant_user_id, body, sender_type, sender_label, created_at, read_at'
        )
        .single();

      if (insertError) {
        console.error('Error inserting tenant message:', insertError);
        throw new Error('Failed to send your message. Please try again.');
      }

      setMessages((prev) => [...prev, inserted as MessageRow]);
      setNewMessage('');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to send your message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // ---------- UI States ----------

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading messages…</p>
      </main>
    );
  }

  if (error && !tenant) {
    // Hard failure before we even have a tenant record
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-slate-900/80 border border-rose-500/60 p-6 shadow-xl space-y-4">
          <p className="text-sm text-rose-100">{error}</p>
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

  // ---------- Main UI ----------

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Header / breadcrumb */}
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs text-slate-500 flex gap-1 items-center">
              <button
                type="button"
                onClick={handleBackToDashboard}
                className="hover:text-emerald-400"
              >
                Tenant
              </button>
              <span>/</span>
              <span className="text-slate-300">Messages</span>
            </div>
            <h1 className="mt-1 text-xl font-semibold text-slate-50">
              Messages with your landlord
            </h1>
            {tenant && landlord && (
              <p className="mt-1 text-[11px] text-slate-500">
                Signed in as{' '}
                <span className="font-medium text-slate-200">
                  {tenant.name || tenant.email}
                </span>{' '}
                · Landlord:{' '}
                <span className="font-medium text-slate-200">
                  {landlord.name || landlord.email}
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              onClick={handleBackToDashboard}
              className="text-xs px-4 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            >
              Back to dashboard
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs px-4 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        </header>

        {/* Alerts */}
        {error && tenant && (
          <div className="rounded-xl border border-rose-500/60 bg-rose-950/40 px-4 py-2 text-sm text-rose-100">
            {error}
          </div>
        )}

        {/* Thread + composer */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-sm flex flex-col gap-3 min-h-[380px]">
          {/* Messages list */}
          <div className="flex-1 space-y-2 overflow-y-auto rounded-xl bg-slate-950/60 p-3 border border-slate-900">
            {messages.length === 0 ? (
              <p className="text-[12px] text-slate-500">
                No messages yet. Send your landlord a message below to start the
                conversation.
              </p>
            ) : (
              messages.map((m) => {
                const isTenant = m.sender_type === 'tenant';
                const alignClass = isTenant
                  ? 'items-end text-right'
                  : 'items-start text-left';
                const bubbleClass = isTenant
                  ? 'bg-emerald-600 text-slate-950'
                  : 'bg-slate-800 text-slate-50';
                const metaColor = isTenant
                  ? 'text-emerald-100/80'
                  : 'text-slate-400';

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${alignClass} gap-0.5 text-[11px]`}
                  >
                    <span className={`font-medium ${metaColor}`}>
                      {m.sender_label ||
                        (isTenant ? 'You (Tenant)' : 'Landlord / Team')}
                    </span>
                    <div
                      className={`inline-block max-w-[85%] rounded-2xl px-3 py-1.5 text-[12px] ${bubbleClass}`}
                    >
                      {m.body}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {formatTimestamp(m.created_at)}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Composer */}
          <form onSubmit={handleSend} className="mt-2 space-y-2">
            <label className="block text-[11px] text-slate-400 mb-1">
              Send a message to your landlord
            </label>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Type your question or update…"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] text-slate-500">
                Your landlord and any authorized team members for this account
                will be able to see and reply to this conversation.
              </p>
              <button
                type="submit"
                disabled={sending || !tenant || !landlord}
                className="rounded-full bg-emerald-500 px-4 py-1.5 text-[12px] font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
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
