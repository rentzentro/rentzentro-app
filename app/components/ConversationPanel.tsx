'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';

type ConversationPanelProps = {
  landlordId: number;
  landlordUserId: string;
  tenantId: number;
  tenantUserId: string;
  currentRole: 'landlord' | 'tenant';
};

type MessageRow = {
  id: number;
  created_at: string;
  landlord_id: number | null;
  landlord_user_id: string | null;
  tenant_id: number | null;
  tenant_user_id: string | null;
  sender_type: 'landlord' | 'tenant';
  body: string;
  read_at: string | null;
};

export function ConversationPanel({
  landlordId,
  landlordUserId,
  tenantId,
  tenantUserId,
  currentRole,
}: ConversationPanelProps) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const otherSenderType: 'landlord' | 'tenant' =
    currentRole === 'landlord' ? 'tenant' : 'landlord';

  // ---------- Mark messages as read ----------

  const markMessagesRead = useCallback(async () => {
    try {
      const { error: updateError } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('landlord_user_id', landlordUserId)
        .eq('tenant_user_id', tenantUserId)
        .eq('sender_type', otherSenderType)
        .is('read_at', null);

      if (updateError) {
        console.error('Failed to mark messages as read:', updateError);
      } else {
        // Optimistically update local state so the user sees them clear immediately
        setMessages((prev) =>
          prev.map((m) =>
            m.sender_type === otherSenderType && m.read_at == null
              ? { ...m, read_at: new Date().toISOString() }
              : m
          )
        );
      }
    } catch (err) {
      console.error('Error in markMessagesRead:', err);
    }
  }, [landlordUserId, tenantUserId, otherSenderType]);

  // ---------- Load messages ----------

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: msgError } = await supabase
          .from('messages')
          .select(
            'id, created_at, landlord_id, landlord_user_id, tenant_id, tenant_user_id, sender_type, body, read_at'
          )
          .eq('landlord_user_id', landlordUserId)
          .eq('tenant_user_id', tenantUserId)
          .order('created_at', { ascending: true });

        if (msgError) throw msgError;

        setMessages((data || []) as MessageRow[]);

        // Once messages are loaded, mark the *other side's* messages as read
        await markMessagesRead();
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to load messages.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [landlordUserId, tenantUserId, markMessagesRead]);

  // ---------- Send message ----------

  const handleSend = async () => {
    if (!input.trim()) return;
    setSending(true);
    setError(null);

    try {
      const senderType: 'landlord' | 'tenant' = currentRole;

      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({
          landlord_id: landlordId,
          landlord_user_id: landlordUserId,
          tenant_id: tenantId,
          tenant_user_id: tenantUserId,
          sender_type: senderType,
          body: input.trim(),
          // read_at should be NULL for the recipient until they view it
          read_at: null,
        })
        .select(
          'id, created_at, landlord_id, landlord_user_id, tenant_id, tenant_user_id, sender_type, body, read_at'
        )
        .single();

      if (insertError) throw insertError;

      setMessages((prev) => [...prev, data as MessageRow]);
      setInput('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (
    e
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sending) {
        void handleSend();
      }
    }
  };

  // ---------- UI ----------

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-slate-400">
        Loading conversation…
      </div>
    );
  }

  return (
    <div className="flex h-[420px] flex-col rounded-2xl border border-slate-800 bg-slate-950/80">
      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {error && (
          <div className="mb-2 rounded-xl border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-[11px] text-rose-100">
            {error}
          </div>
        )}

        {messages.length === 0 ? (
          <p className="text-[11px] text-slate-500">
            No messages yet. Start the conversation below.
          </p>
        ) : (
          messages.map((m) => {
            const isMine = m.sender_type === currentRole;
            const align = isMine ? 'items-end' : 'items-start';
            const bubbleClasses = isMine
              ? 'bg-emerald-500 text-slate-950'
              : 'bg-slate-800 text-slate-50';
            const metaAlign = isMine ? 'text-right' : 'text-left';

            return (
              <div key={m.id} className={`flex flex-col ${align}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs ${bubbleClasses}`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </div>
                <div
                  className={`mt-0.5 text-[10px] text-slate-500 ${metaAlign}`}
                >
                  {new Date(m.created_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {!isMine && !m.read_at && (
                    <span className="ml-1 text-amber-300">
                      • Unread by you
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-slate-800 bg-slate-950/90 px-3 py-2">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            rows={2}
            placeholder="Type a message…"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="self-end rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
