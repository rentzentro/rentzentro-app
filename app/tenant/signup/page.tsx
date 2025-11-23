'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../supabaseClient';

export default function TenantSignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Prefill email from invite link
  useEffect(() => {
    const invitedEmail = searchParams.get('email');
    if (invitedEmail) {
      setEmail(invitedEmail);
    }
  }, [searchParams]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email) {
      setError('Please enter your email.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        console.error('Tenant sign-up error:', signUpError);
        setError(signUpError.message || 'Unable to complete signup.');
        return;
      }

      // If email confirmation is disabled, Supabase may return a session here
      console.log('Tenant signup data:', data);

      setSuccess('Account created! Redirecting to your tenant portal...');
      // Short delay then go to tenant portal
      setTimeout(() => {
        router.push('/tenant/portal');
      }, 1200);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Unexpected error during signup.');
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
          Tenant signup
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Create a password to access your RentZentro tenant portal. Use the
          same email address your landlord used when they invited you.
        </p>

        {(error || success) && (
          <div
            className={`mt-4 rounded-xl border px-3 py-2 text-xs ${
              error
                ? 'border-rose-500/60 bg-rose-950/50 text-rose-100'
                : 'border-emerald-500/60 bg-emerald-950/40 text-emerald-100'
            }`}
          >
            {error || success}
          </div>
        )}

        <form onSubmit={handleSignup} className="mt-4 space-y-4">
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
            <p className="text-[11px] text-slate-500">
              This must match the email your landlord used for your invite.
            </p>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="block text-xs font-medium text-slate-300"
            >
              Create a password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 pr-10 text-sm text-slate-50 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="At least 6 characters"
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

          <div className="space-y-1">
            <label
              htmlFor="passwordConfirm"
              className="block text-xs font-medium text-slate-300"
            >
              Confirm password
            </label>
            <input
              id="passwordConfirm"
              type={showPassword ? 'text' : 'password'}
              required
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="Re-enter password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-[11px] text-slate-500">
          Already created your account?{' '}
          <Link
            href="/tenant/login"
            className="text-emerald-400 hover:text-emerald-300"
          >
            Log in here
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
