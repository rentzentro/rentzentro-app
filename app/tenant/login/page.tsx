'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../supabaseClient';

// Production site URL. Reads from env, falls back to live domain.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rentzentro.com';

export default function TenantLoginPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setMessage(null);
    setError(null);

    try {
      // TENANTS SHOULD ALWAYS LAND HERE AFTER EMAIL LINK
      const redirectTo = `${SITE_URL}/tenant/signup`;

      const { error: sendError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (sendError) {
        console.error('Tenant magic link error:', sendError);
        setError(sendError.message || 'Failed to send login link.');
        return;
      }

      setMessage(
        'Check your email — we sent you a secure link to continue signing up.'
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Unexpected error sending login link.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-xl shadow-black/40">
        <Link
          href="/"
          className="text-xs text-slate-400 hover:text-emerald-400"
        >
          ← Back to homepage
        </Link>

        <h1 className="mt-3 text-xl font-semibold text-slate-50">
          Tenant Login / Signup
        </h1>

        <p className="mt-1 text-sm text-slate-400">
          Enter your email. We will send you a link to finish signing up to access your tenant portal.
        </p>

        <form onSubmit={handleSendLink} className="mt-5 space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="email"
              className="block text-xs font-medium text-slate-300"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {sending ? 'Sending...' : 'Send signup link'}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-xs text-emerald-300 bg-emerald-950/30 border border-emerald-700/60 rounded-2xl px-3 py-2">
            {message}
          </p>
        )}

        {error && (
          <p className="mt-4 text-xs text-rose-300 bg-rose-950/30 border border-rose-700/60 rounded-2xl px-3 py-2">
            {error}
          </p>
        )}

        <p className="mt-6 text-[11px] text-slate-500">
          If you weren’t expecting this, ignore the email.
        </p>
      </div>
    </div>
  );
}
