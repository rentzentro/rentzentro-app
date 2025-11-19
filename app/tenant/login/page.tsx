'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../supabaseClient';

export default function TenantLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      router.push('/tenant/portal');
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message || 'Unable to sign in. Please check your details.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setError(null);
    setInfo(null);

    if (!email) {
      setError('Enter your email above first, then click "Forgot password?".');
      return;
    }

    setResetLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth/update-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo }
      );

      if (resetError) throw resetError;

      setInfo('Password reset email sent. Check your inbox.');
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Unable to start password reset. Please try again in a moment.'
      );
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-sm">
        <div className="mb-4">
          <Link
            href="/"
            className="text-[11px] text-slate-500 hover:text-emerald-400"
          >
            ← Back to homepage
          </Link>
        </div>

        <h1 className="text-lg font-semibold text-slate-50 mb-1">
          Tenant login
        </h1>
        <p className="text-xs text-slate-400 mb-4">
          Sign in to view your rent amount, due date, payment history, and
          documents shared by your landlord.
        </p>

        {error && (
          <div className="mb-3 rounded-xl bg-rose-950/40 border border-rose-500/40 px-3 py-2 text-xs text-rose-100">
            {error}
          </div>
        )}
        {info && (
          <div className="mb-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 px-3 py-2 text-xs text-emerald-100">
            {info}
          </div>
        )}

        <form onSubmit={handleSignIn} className="space-y-3 text-sm">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 pr-16 text-sm text-slate-50 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-2 flex items-center text-[11px] text-slate-400 hover:text-slate-200"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] mt-1">
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={resetLoading}
              className="text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline disabled:opacity-60"
            >
              {resetLoading ? 'Sending reset email…' : 'Forgot password?'}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-3 w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in as tenant'}
          </button>
        </form>
      </div>
    </div>
  );
}
