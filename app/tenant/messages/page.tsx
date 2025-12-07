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
  user_id: string | null;  // auth.uid() for this tenant
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
        const email = user.email || '';

        // 2) Find tenant row for this user:
        //    - First by user_id
        //    - If not found, fallback by email and BACKFILL user_id
        let tenantTyped: TenantRow | null = null;

        // 2a) By user_id
        const {
          data: tenantByUser,
          error: tenantByUserError,
        } = await supabase
          .from('tenants')
          .select('id, name, email, owner_id, user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (tenantByUserError) {
          console.error('Error loading tenant by user_id:', tenantByUserError);
          throw new Error(
            'We could not load your tenant account. Please contact your landlord.'
          );
        }

        if (tenantByUser) {
          tenantTyped = tenantByUser as TenantRow;
        }

        // 2b) Fallback: by email (older / re-invited tenants)
        if (!tenantTyped && email) {
          const {
            data: tenantByEmail,
            error: tenantByEmailError,
          } = await supabase
            .from('tenants')
            .select('id, name, email, owner_id, user_id')
            .eq('email', email)
            .maybeSingle();

          if (tenantByEmailError) {
            console.error('Error loading tenant by email:', tenantByEmailError);
            throw new Error(
              'We could not load your tenant account. Please contact your landlord.'
            );
          }

          if (tenantByEmail) {
            tenantTyped = tenantByEmail as TenantRow;

            // Backfill user_id so this tenant is properly linked going forward
            if (!tenantTyped.user_id) {
              try {
                await supabase
                  .from('tenants')
                  .update({ user_id: user.id })
                  .eq('id', tenantTyped.id);
              } catch (patchErr) {
                console.warn(
                  'Warning: failed to backfill tenant.user_id:',
                  patchErr
                );
              }
            }
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

        // 3) Find the landlord row by owner_id (landlord user UUID)
        const {
          data: landlordRow,
          error: landlordError,
        } = await supabase
          .from('landlords')
          .select('id, user_id, name, email')
          .eq('user_id', tenantTyped.owner_id)
          .maybeSingle();

        if (landlordError) {
          console.error('Error loading landlord row:', landlordError);
          throw new Error(
            'We could not load your landlord account. Please contact your landlord.'
          );
        }

        if (!landlordRow) {
          // Soft-failure: tenant can still write, but landlord account is missing
          setLandlord(null);
          setError(
            'Landlord account for this property could not be loaded. Please confirm with your landlord that their RentZentro landlord account is active.'
          );
        } else {
          const landlordTyped = landlordRow as LandlordRow;
          setLandlord(landlordTyped);
        }

        // 4) Load existing messages for this landlord/tenant pair
        const landlordIdForQuery = (landlordRow as LandlordRow | null)?.id;

        let messagesQuery = supabase
          .from('messages')
          .select(
            'id, landlord_id, landlord_user_id, tenant_id, tenant_user_id, body, sender_type, sender_label, created_at, read_at'
          )
          .eq('tenant_id', tenantTyped.id);

        if (landlordIdForQuery) {
          messagesQuery = messagesQuery.eq('landlord_id', landlordIdForQuery);
        }

        const {
          data: messagesData,
          error: messagesError,
        } = await messagesQuery.order('created_at', { ascending: true });

        if (messagesError) {
          console.error('Error loading messages:', messagesError);
          throw new Error(
            'We had trouble loading your message history. Please try again.'
          );
        }

        setMessages((messagesData || []) as MessageRow[]);

        // 5) Mark landlord/team messages as read for this tenant
        try {
          if (landlordIdForQuery) {
            await supabase
              .from('messages')
              .update({ read_at: new Date().toISOString() })
              .eq('landlord_id', landlordIdForQuery)
              .eq('tenant_id', tenantTyped.id)
              .eq('tenant_user_id', user.id)
              .is('read_at', null)
              .in('sender_type', ['landlord', 'team']);
          }
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
    if (!tenant) return; // we now allow sending even if landlord is null

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

      const landlordId = landlord?.id || null;
      const landlordUserId = landlord?.user_id || tenant.owner_id || null;

      if (!landlordUserId) {
        throw new Error(
          'We could not determine your landlord account for this property. Please contact your landlord.'
        );
      }

      // Label shown in the thread
      const senderLabel = `${
        tenant.name || tenant.email || user.email || 'You'
      } (Tenant)`;

      const insertPayload = {
        landlord_id: landlordId,
        landlord_user_id: landlordUserId,
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

      // TODO: call /api/messages/email if you want tenant->landlord email here
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message || 'Failed to send your message. Please try again.'
      );
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
            {tenant && (
              <p className="mt-1 text-[11px] text-slate-500">
                Signed in as{' '}
                <span className="font-medium text-slate-200">
                  {tenant.name || tenant.email}
                </span>{' '}
                {landlord && (
                  <>
                    · Landlord:{' '}
                    <span className="font-medium text-slate-200">
                      {landlord.name || landlord.email}
                    </span>
                  </>
                )}
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
          <div className="rounded-xl border border-amber-500/70 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
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
                const isTenantSender = m.sender_type === 'tenant';
                const alignClass = isTenantSender
                  ? 'items-end text-right'
                  : 'items-start text-left';
                const bubbleClass = isTenantSender
                  ? 'bg-emerald-600 text-slate-950'
                  : 'bg-slate-800 text-slate-50';
                const metaColor = isTenantSender
                  ? 'text-emerald-100/80'
                  : 'text-slate-400';

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${alignClass} gap-0.5 text-[11px]`}
                  >
                    <span className={`font-medium ${metaColor}`}>
                      {m.sender_label ||
                        (isTenantSender ? 'You (Tenant)' : 'Landlord / Team')}
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
                disabled={sending || !tenant}
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
