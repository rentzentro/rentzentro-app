'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

export default function TenantLoginPage() {
  const router = useRouter();
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
      if (!email.trim()) {
        setError('Please enter your email address.');
        return;
      }

      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/tenant/portal`
          : undefined;

      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (signInError) {
        console.error('Tenant magic link error:', signInError);
        setError(signInError.message || 'Unable to send login link.');
        return;
      }

      setMessage(
        'Check your email for a login link. Open it on this device to access your tenant portal.'
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
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="text-[11px] text-slate-400 hover:text-emerald-300 mb-4"
        >
          ← Back to homepage
        </button>

        <h1 className="text-xl font-semibold text-slate-50 mb-1">
          Tenant login
        </h1>
        <p className="text-sm text-slate-400 mb-4">
          Enter the email your landlord used for your account. We&apos;ll send
          you a secure login link to access your tenant portal.
        </p>

        <form onSubmit={handleSendLink} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="you@example.com"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/50 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-100">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending link…' : 'Email me a login link'}
          </button>
        </form>

        <p className="mt-4 text-[11px] text-slate-500">
          If you don&apos;t see the email, check your spam or promotions
          folder. The link will expire after a short time.
        </p>
      </div>
    </div>
  );
}
