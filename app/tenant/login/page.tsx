'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../supabaseClient';

export default function TenantLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        console.error('Tenant login error:', signInError);
        setError(signInError.message);
        setLoading(false);
        return;
      }

      // ✅ Success – go to the tenant portal
      router.push('/tenant/portal');
    } catch (err: any) {
      console.error('Tenant login unexpected error:', err);
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Back link */}
        <div>
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1"
          >
            <span>←</span> Back to home
          </Link>
        </div>

        {/* Header */}
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">
            Tenant portal
          </p>
          <h1 className="text-2xl font-semibold">Sign in to view your rent</h1>
          <p className="text-xs text-slate-400">
            Use the email and password your landlord set up for you. If you don&apos;t
            have an account yet, ask them to add you to RentZentro.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-slate-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 text-sm font-medium py-2 mt-2"
          >
            {loading ? 'Signing you in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-[11px] text-slate-500">
          Don&apos;t have a login yet? Ask your landlord to create a tenant account for
          you in RentZentro.
        </p>
      </div>
    </main>
  );
}
