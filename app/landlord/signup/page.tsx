'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

export default function LandlordSignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error(error);
      setError(error.message ?? 'Unable to create account.');
      setLoading(false);
      return;
    }

    // If email confirmation is off, session may be created immediately
    if (data.session) {
      setMessage('Account created! Redirecting to your dashboard…');
      setTimeout(() => router.push('/landlord'), 1000);
    } else {
      // If email confirmations are on in Supabase
      setMessage(
        'Account created. Check your email to confirm your address, then come back and log in.'
      );
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Back link */}
        <Link
          href="/landlord/login"
          className="inline-flex items-center text-xs text-slate-400 hover:text-slate-200"
        >
          ← Back to landlord login
        </Link>

        {/* Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-950/40">
          <h1 className="text-xl font-semibold">Create landlord account</h1>
          <p className="mt-1 text-xs text-slate-400">
            Use this account to manage properties, tenants, and rent payments.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/60 bg-red-950/60 px-3 py-2 text-xs text-red-100">
              {error}
            </div>
          )}

          {message && (
            <div className="mt-4 rounded-lg border border-emerald-500/60 bg-emerald-950/60 px-3 py-2 text-xs text-emerald-100">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                placeholder="Create a password"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Confirm password
              </label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                placeholder="Repeat your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {loading ? 'Creating account…' : 'Create landlord account'}
            </button>
          </form>

          <p className="mt-4 text-xs text-slate-400 text-center">
            Already have a landlord account?{' '}
            <Link
              href="/landlord/login"
              className="text-emerald-300 hover:text-emerald-200 font-medium"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
