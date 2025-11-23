'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

export default function TenantLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('Tenant login error:', signInError);
        setError(signInError.message || 'Unable to log in.');
        return;
      }

      router.push('/tenant/portal');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Unexpected error while logging in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-xl shadow-black/40">
        <Link
          href="/"
          className="text-xs text-slate-400 hover:text-emerald-400"
        >
          ← Back to homepage
        </Link>

        <h1 className="mt-3 text-xl font-semibold text-slate-50">
          Tenant login
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Log in with the email and password you used when creating your
          RentZentro tenant account.
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/60 bg-rose-950/50 px-3 py-2 text-xs text-rose-100">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-4 space-y-4">
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

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="block text-xs font-medium text-slate-300"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 pr-10 text-sm text-slate-50 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="Your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[11px] text-slate-400 hover:text-slate-200"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Signing in…' : 'Log in'}
          </button>
        </form>

        <p className="mt-4 text-[11px] text-slate-500">
          First time here?{' '}
          <Link
            href="/tenant/signup"
            className="text-emerald-400 hover:text-emerald-300"
          >
            Create a tenant account
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
