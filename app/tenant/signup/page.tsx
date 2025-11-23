'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

export default function TenantSignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    if (password !== passwordConfirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // 1) Create the Supabase Auth user
      const {
        data: signUpData,
        error: signUpError,
      } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'tenant',
            full_name: fullName || null,
          },
        },
      });

      if (signUpError) {
        // Friendly message if the user already exists
        if (
          signUpError.message
            ?.toLowerCase()
            .includes('user already registered')
        ) {
          setError(
            'You already have a RentZentro tenant account. Please log in instead.'
          );
          return;
        }

        setError(signUpError.message || 'Unable to sign up tenant.');
        return;
      }

      let session = signUpData.session;

      // 2) If Supabase didn’t auto-log them in (e.g., email confirmation settings),
      // try to sign in immediately with the same credentials.
      if (!session) {
        const {
          data: signInData,
          error: signInError,
        } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setError(
            signInError.message ||
              'Account created, but we could not log you in. Please try logging in manually.'
          );
          return;
        }

        session = signInData.session;
      }

      // 3) If we have a session, just send the tenant to their portal.
      if (!session || !session.user) {
        setError(
          'Account created, but we could not establish a login session. Please log in and try again.'
        );
        return;
      }

      // (Optional) We *don’t* try to edit the tenants table here to avoid RLS issues.
      // The portal will look up the tenant row by email.

      router.push('/tenant/portal');
    } catch (err: any) {
      console.error('Tenant signup error:', err);
      setError(err.message || 'Unexpected error during tenant signup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
        <Link
          href="/"
          className="text-xs text-slate-400 hover:text-emerald-400"
        >
          ← Back to homepage
        </Link>

        <h1 className="mt-4 text-xl font-semibold text-slate-50">
          Create your tenant account
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          This account lets you log in to view rent, leases, and maintenance
          requests for your unit.
        </p>

        {error && (
          <div className="mt-3 rounded-lg border border-rose-500/50 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
            {error}
          </div>
        )}

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              Full name (optional)
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-500"
              placeholder="John Tenant"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-500"
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-20 text-sm text-slate-50 outline-none focus:border-emerald-500"
                placeholder="Create a password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 text-[11px] text-slate-400 hover:text-emerald-400"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              Confirm password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-500"
              placeholder="Re-enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? 'Creating account…' : 'Create tenant account'}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-400">
          Already have a tenant account?{' '}
          <Link
            href="/tenant/login"
            className="font-medium text-emerald-400 hover:text-emerald-300"
          >
            Log in
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
