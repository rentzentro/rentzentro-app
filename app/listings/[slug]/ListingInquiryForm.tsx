'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

export default function ListingInquiryForm({ listingId }: { listingId: number }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOk(null);
    setErr(null);

    if (!name.trim() || !email.trim() || !message.trim()) {
      setErr('Please fill in name, email, and a message.');
      return;
    }

    setLoading(true);
    try {
      // IMPORTANT: owner_id is set by RLS policy via EXISTS check (listing published).
      // But your table requires owner_id NOT NULL.
      // So we must fetch listing.owner_id first (public read allowed ONLY if published).
      const { data: listingRow, error: listingErr } = await supabase
        .from('listings')
        .select('id, owner_id, published')
        .eq('id', listingId)
        .maybeSingle();

      if (listingErr) throw listingErr;
      if (!listingRow || !listingRow.published) {
        throw new Error('This listing is not accepting inquiries.');
      }

      const { error } = await supabase.from('listing_inquiries').insert({
        listing_id: listingId,
        owner_id: listingRow.owner_id,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        message: message.trim(),
        status: 'new',
      });

      if (error) throw error;

      setOk('Sent! The landlord will review your message.');
      setName('');
      setEmail('');
      setPhone('');
      setMessage('');
    } catch (e: any) {
      setErr(e?.message || 'Failed to send. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {err && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-[12px] text-rose-100">
          {err}
        </div>
      )}
      {ok && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-3 text-[12px] text-emerald-100">
          {ok}
        </div>
      )}

      <input
        className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-500/60"
        placeholder="Your name *"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-500/60"
        placeholder="Your email *"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        inputMode="email"
      />
      <input
        className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-500/60"
        placeholder="Phone (optional)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        inputMode="tel"
      />
      <textarea
        className="min-h-[110px] w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-500/60"
        placeholder="Message *"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

      <button
        disabled={loading}
        className="w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
      >
        {loading ? 'Sending…' : 'Send inquiry'}
      </button>

      <p className="text-[11px] text-slate-500">
        Do not include sensitive personal info. This goes to the landlord’s RentZentro inbox.
      </p>
    </form>
  );
}
