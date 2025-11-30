'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';

type SenderType = 'landlord' | 'tenant';

type Message = {
  id: string;
  landlord_id: number;
  landlord_user_id: string;
  tenant_id: number;
  tenant_user_id: string;
  body: string;
  sender_type: SenderType;
  created_at: string;
  read_at: string | null;
};

interface ConversationPanelProps {
  landlordId: number;
  landlordUserId: string;
  tenantId: number;
  tenantUserId: string;
  currentRole: SenderType;
}

export function ConversationPanel({
  landlordId,
  landlordUserId,
  tenantId,
  tenantUserId,
  currentRole,
}: ConversationPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Load existing messages + subscribe to new ones
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('landlord_id', landlordId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error('Error loading messages', error);
      } else if (data) {
        setMessages(data as Message[]);
      }
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel(`messages-${landlordId}-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (
            newMsg.landlord_id === landlordId &&
            newMsg.tenant_id === tenantId
          ) {
            setMessages((prev) => [...prev, newMsg]);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [landlordId, tenantId]);

  // Auto-scroll when messages change
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const body = input.trim();
    setInput('');
    setSending(true);

    const { error } = await supabase.from('messages').insert({
      landlord_id: landlordId,
      landlord_user_id: landlordUserId,
      tenant_id: tenantId,
      tenant_user_id: tenantUserId,
      body,
      sender_type: currentRole,
    });

    if (error) {
      console.error('Error sending message', error);
      // Put the text back if sending failed
      setInput(body);
    }

    setSending(false);
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString();
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-950/80">
      {/* Header */}
      <div className="border-b border-slate-800 px-4 py-3 text-sm font-medium text-slate-100">
        Messages
        <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
          {currentRole === 'landlord' ? 'You ↔ Tenant' : 'You ↔ Landlord'}
        </span>
      </div>

      {/* Messages list */}
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3 text-sm">
        {loading && (
          <div className="text-xs text-slate-400">Loading messages…</div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-xs text-slate-400">
            No messages yet. Say hello to start the conversation.
          </div>
        )}

        {messages.map((m) => {
          const isMine = m.sender_type === currentRole;
          return (
            <div
              key={m.id}
              className={isMine ? 'flex justify-end' : 'flex justify-start'}
            >
              <div
                className={
                  'max-w-[80%] rounded-2xl px-3 py-2 text-xs ' +
                  (isMine
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-100')
                }
              >
                <div className="whitespace-pre-wrap">{m.body}</div>
                <div className="mt-1 text-[10px] opacity-70">
                  {formatDateTime(m.created_at)}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="border-t border-slate-800 px-3 py-2"
      >
        <div className="flex items-end gap-2">
          <textarea
            className="min-h-[40px] max-h-[100px] flex-1 resize-none rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
            placeholder="Type a message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="inline-flex items-center rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
