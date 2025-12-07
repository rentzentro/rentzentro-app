'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

type MessageRow = {
  id: string;
  landlord_id: number | null;
  landlord_user_id: string | null;
  tenant_id: number | null;
  tenant_user_id: string | null;
  body: string;
  sender_type: string;
  sender_label: string | null;
  created_at: string;
};

export default function TenantMessagesPage() {
  const router = useRouter();

  const [tenant, setTenant] = useState<any>(null);
  const [landlord, setLandlord] = useState<any>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -------------------------------
  // Load tenant + landlord context
  // -------------------------------
  useEffect(() => {
    async function loadContext() {
      setLoading(true);
      setError(null);

      try {
        // 1) Auth user
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError) {
          console.error('auth.getUser error', authError);
          setError('We could not verify your login. Please sign in again.');
          return;
        }

        const user = authData.user;

        if (!user) {
          router.push('/tenant/login');
          return;
        }

        // 2) Tenant row
        const { data: tenantRow, error: tenantError } = await supabase
          .from('tenants')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (tenantError) {
          console.error('tenant query error', tenantError);
          setError('We could not load your tenant account.');
          return;
        }

        if (!tenantRow) {
          setError(
            'We could not find a tenant account for this login. Please contact your landlord.'
          );
          return;
        }

        setTenant(tenantRow);

        // 3) Property → owner id
        const { data: propertyRow, error: propertyError } = await supabase
          .from('properties')
          .select('owner_id')
          .eq('id', tenantRow.property_id)
          .maybeSingle();

        if (propertyError) {
          console.error('property query error', propertyError);
          setError('We could not load your landlord information.');
          return;
        }

        if (!propertyRow?.owner_id) {
          setError('Landlord account for this team owner could not be found.');
          return;
        }

        // 4) Landlord row by owner_id (user_id on landlords)
        const { data: landlordRow, error: landlordError } = await supabase
          .from('landlords')
          .select('*')
          .eq('user_id', propertyRow.owner_id)
          .maybeSingle();

        if (landlordError) {
          console.error('landlord query error', landlordError);
          setError('We could not load your landlord information.');
          return;
        }

        if (!landlordRow) {
          setError('Landlord account for this team owner could not be found.');
          return;
        }

        setLandlord(landlordRow);

        // 5) Load messages thread
        await loadMessages(landlordRow.id, tenantRow.id);
      } catch (err) {
        console.error('Unexpected error loading tenant messages:', err);
        setError('Something went wrong loading your messages.');
      } finally {
        // ✅ Always turn off loading so either messages OR the error card shows
        setLoading(false);
      }
    }

    loadContext();
  }, [router]);

  // -------------------------------
  // Load thread messages
  // -------------------------------
  async function loadMessages(landlordId: number, tenantId: number) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('landlord_id', landlordId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('messages query error', error);
      setError('We could not load your message history.');
      return;
    }

    if (data) {
      setMessages(data as MessageRow[]);
    }
  }

  // -------------------------------
  // Send message (Tenant → Landlord/Team)
  // -------------------------------
  async function sendMessage() {
    if (!newMessage.trim() || !tenant || !landlord) return;

    setSending(true);
    setError(null);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        setError('You must be logged in to send messages.');
        return;
      }

      // Label that shows in the thread
      const senderLabel: string =
        (tenant.name && tenant.name.trim()) ||
        tenant.email ||
        'Tenant';

      const insertPayload = {
        landlord_id: landlord.id,
        landlord_user_id: landlord.user_id,
        tenant_id: tenant.id,
        tenant_user_id: tenant.user_id,
        body: newMessage.trim(),
        sender_type: 'tenant',
        sender_label: senderLabel,
      };

      const { data, error } = await supabase
        .from('messages')
        .insert(insertPayload)
        .select('*')
        .single();

      if (error) {
        console.error('insert message error', error);
        setError('Failed to send your message. Please try again.');
        return;
      }

      setMessages((prev) => [...prev, data as MessageRow]);
      setNewMessage('');
    } catch (err) {
      console.error('Unexpected send error', err);
      setError('Failed to send your message. Please try again.');
    } finally {
      setSending(false);
    }
  }

  // -------------------------------
  // UI
  // -------------------------------
  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading messages...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-red-500/60 bg-red-950/40 p-6 text-center shadow-xl">
          <p className="mb-4 text-sm text-red-100">{error}</p>
          <button
            onClick={() => router.push('/tenant/login')}
            className="rounded-full bg-slate-900 border border-slate-700 px-4 py-2 text-[13px] font-medium text-slate-100 hover:bg-slate-800"
          >
            Back to tenant login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto max-w-xl space-y-4">
        <header>
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            Tenant portal
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50">
            Messages with your landlord
          </h1>
          {landlord && (
            <p className="text-[11px] text-slate-400 mt-1">
              You&apos;re messaging:{' '}
              <span className="font-medium text-slate-100">
                {landlord.name || landlord.email}
              </span>
            </p>
          )}
        </header>

        {/* Messages list */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3 max-h-[60vh] overflow-y-auto space-y-3">
          {messages.length === 0 ? (
            <p className="text-xs text-slate-500">
              No messages yet. Send your first message below.
            </p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl px-3 py-2 text-sm ${
                  m.sender_type === 'tenant'
                    ? 'bg-emerald-900/40 border border-emerald-500/40 text-emerald-50'
                    : 'bg-slate-900/80 border border-slate-700 text-slate-100'
                }`}
              >
                <p className="text-[11px] text-slate-400 mb-0.5">
                  {m.sender_label}
                </p>
                <p>{m.body}</p>
              </div>
            ))
          )}
        </section>

        {/* Composer */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3 space-y-2">
          <p className="text-[11px] text-slate-500">
            Send a message to your landlord or their team.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Type a message…"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={sending || !newMessage.trim()}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
