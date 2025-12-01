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
  read_at: string | null; // when the *recipient* saw it
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

  // ---------- Mark messages as read (for this viewer) ----------

  const markMessagesRead = useCallback(async () => {
    try {
      const { error: updateError } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('landlord_user_id', landlordUserId)
        .eq('tenant_user_id', tenantUserId)
        .eq('sender_type', otherSenderType) // messages FROM the other side
        .is('read_at', null);

      if (updateError) {
        console.error('Failed to mark messages as read:', updateError);
      } else {
        // Optimistically update local state
        const nowIso = new Date().toISOString();
        setMessages((prev) =>
          prev.map((m) =>
            m.sender_type === otherSenderType && m.read_at == null
              ? { ...m, read_at: nowIso }
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

  // ---------- Send message + trigger email notification ----------

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
          read_at: null, // recipient hasn't seen it yet
        })
        .select(
          'id, created_at, landlord_id, landlord_user_id, tenant_id, tenant_user_id, sender_type, body, read_at'
        )
        .single();

      if (insertError) throw insertError;

      const newMsg = data as MessageRow;
      setMessages((prev) => [...prev, newMsg]);
      setInput('');

      // Fire-and-forget: email notification to the other side
      try {
        await fetch('/api/messages/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: newMsg.id }),
        });
      } catch (notifyErr) {
        // Don't block UI if email fails
        console.error('Failed to send message email notification:', notifyErr);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: any) => {
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

  // Helper: find the last message sent BY ME
  const lastSentByMe = [...messages].reverse().find(
    (m) => m.sender_type === currentRole
  );

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

            const createdLabel = new Date(m.created_at).toLocaleString(
              'en-US',
              {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              }
            );

            // Read receipt text for *my* messages
            let statusLabel: string | null = null;
            if (isMine) {
              if (m.read_at) {
                statusLabel = 'Seen';
              } else {
                statusLabel = 'Sent';
              }
            }

            const isLastSentByMe = lastSentByMe && lastSentByMe.id === m.id;

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
                  {createdLabel}
                  {isMine && statusLabel && (
                    <>
                      {' '}
                      •{' '}
                      <span
                        className={
                          isLastSentByMe && m.read_at
                            ? 'text-emerald-400'
                            : 'text-slate-400'
                        }
                      >
                        {statusLabel}
                      </span>
                    </>
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
