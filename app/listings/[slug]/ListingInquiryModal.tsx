'use client';

import { useMemo, useState } from 'react';

export default function ListingInquiryModal(props: {
  listingId: number;
  listingSlug: string;
  listingTitle: string;
}) {
  const { listingId, listingSlug, listingTitle } = props;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSend = useMemo(() => {
    const n = name.trim().length >= 2;
    const e = /^\S+@\S+\.\S+$/.test(email.trim());
    const m = message.trim().length >= 5;
    return n && e && m && !sending;
  }, [name, email, message, sending]);

  const reset = () => {
    setName('');
    setEmail('');
    setPhone('');
    setMessage('');
    setErr(null);
    setSent(false);
  };

  const close = () => {
    setOpen(false);
    setErr(null);
  };

  const onSubmit = async () => {
    setErr(null);
    setSending(true);
    try {
      const res = await fetch('/api/listing-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId,
          listingSlug,
          listingTitle,
          name,
          email,
          phone: phone.trim() || null,
          message,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j?.error || 'Failed to send inquiry. Please try again.');
        setSending(false);
        return;
      }

      setSent(true);
      setSending(false);
    } catch {
      setErr('Failed to send inquiry. Please try again.');
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
      >
        Send inquiry
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
            <div className="flex items-start justify-between gap-3 border-b border-slate-900 p-5">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Listing inquiry
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-50">
                  {listingTitle || 'Rental listing'}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  This sends a one-way inquiry to the landlord (and their team).
                </p>
              </div>

              <button
                type="button"
                onClick={close}
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 hover:bg-slate-800"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-5">
              {sent ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4">
                  <p className="text-sm font-semibold text-emerald-200">
                    Inquiry sent
                  </p>
                  <p className="mt-1 text-[11px] text-slate-300">
                    The landlord will reach out using the contact info you provided.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        reset();
                      }}
                      className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                    >
                      Send another
                    </button>
                    <button
                      type="button"
                      onClick={close}
                      className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {err && (
                    <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-950/30 p-3">
                      <p className="text-[11px] font-semibold text-rose-200">
                        {err}
                      </p>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-300">
                        Your name
                      </label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/50"
                        placeholder="Jane Doe"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-300">
                        Email
                      </label>
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/50"
                        placeholder="jane@email.com"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[11px] font-medium text-slate-300">
                        Phone (optional)
                      </label>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/50"
                        placeholder="(401) 555-1234"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[11px] font-medium text-slate-300">
                        Message
                      </label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={5}
                        className="w-full resize-none rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/50"
                        placeholder="Hi — I’m interested. What days/times are available for a showing?"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        Tip: include ideal move-in date and income/employment basics to get faster replies.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] text-slate-500">
                      One-way inquiry (no chat). Landlord replies via your email/phone.
                    </p>

                    <button
                      type="button"
                      disabled={!canSend}
                      onClick={onSubmit}
                      className="rounded-full bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sending ? 'Sending…' : 'Send inquiry'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
