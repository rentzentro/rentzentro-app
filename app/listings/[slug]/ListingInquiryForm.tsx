'use client';

import { useState } from 'react';

export default function ListingInquiryForm({
  listingId,
  listingTitle,
  listingSlug,
}: {
  listingId: number;
  listingTitle: string;
  listingSlug: string;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setError(null);

    if (!name.trim()) return setError('Please enter your name.');
    if (!email.trim()) return setError('Please enter your email.');
    if (!message.trim()) return setError('Please write a short message.');

    setBusy(true);
    try {
      const res = await fetch('/api/listings/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId,
          listingTitle,
          listingSlug,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          message: message.trim(),
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || 'Failed to send inquiry.');
      }

      setSent(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to send inquiry.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4">
        <p className="text-sm font-semibold text-emerald-200">Inquiry sent</p>
        <p className="mt-1 text-[11px] text-slate-300">
          Your message was delivered to the landlord (and team members, if enabled). They’ll contact you
          using the email/phone you provided.
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setName('');
            setEmail('');
            setPhone('');
            setMessage('');
          }}
          className="mt-3 rounded-full border border-slate-700 bg-slate-950/60 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-900"
        >
          Send another inquiry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-100">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[11px] text-slate-500 uppercase tracking-wide">Your name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
            placeholder="Jane Doe"
            autoComplete="name"
          />
        </div>

        <div>
          <label className="text-[11px] text-slate-500 uppercase tracking-wide">Email *</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
            placeholder="jane@email.com"
            autoComplete="email"
            inputMode="email"
          />
        </div>
      </div>

      <div>
        <label className="text-[11px] text-slate-500 uppercase tracking-wide">Phone (optional)</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
          placeholder="(401) 555-1234"
          autoComplete="tel"
          inputMode="tel"
        />
      </div>

      <div>
        <label className="text-[11px] text-slate-500 uppercase tracking-wide">Message *</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1 min-h-[120px] w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
          placeholder="Hi — I’m interested in this rental. When is the earliest showing available?"
        />
        <p className="mt-1 text-[11px] text-slate-500">
          This is a one-way inquiry. Landlord replies directly to you.
        </p>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="w-full rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
      >
        {busy ? 'Sending…' : 'Send inquiry'}
      </button>

      <p className="text-[10px] text-slate-500">
        Listing: <span className="text-slate-300 font-semibold">{listingTitle}</span> ·{' '}
        <span className="font-mono text-slate-400">/listings/{listingSlug}</span>
      </p>
    </div>
  );
}
