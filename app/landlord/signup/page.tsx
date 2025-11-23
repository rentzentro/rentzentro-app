'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../supabaseClient';

export default function LandlordSignupPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!email || !password) {
        throw new Error('Email and password are required.');
      }

      // 1) Create Supabase auth user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) {
        throw signUpError;
      }

      const authedEmail =
        signUpData.user?.email?.trim().toLowerCase() ?? email.trim().toLowerCase();

      // 2) Insert landlord row tied to this email
      const { error: landlordError } = await supabase.from('landlords').insert({
        email: authedEmail,
        name: name || 'Default Landlord',
      });

      if (landlordError) {
        console.error('Error inserting landlord row:', landlordError);
        // Not fatal for auth, but we DO want to surface it because dashboard relies on it
        throw new Error('Your account was created, but we could not finish setup. Please contact support.');
      }

      // 3) Send them into the app.
      // The landlord dashboard will redirect to /landlord/subscription
      // if subscription_status is not active.
      router.push('/landlord');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Unable to create landlord account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <Link
          href="/"
          className="text-xs text-slate-500 hover:text-emerald-300"
        >
          ← Back to homepage
        </Link>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-50">
            Create your landlord account
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            This account lets you log in to the RentZentro landlord dashboard.
            You&apos;ll start your subscription on the next step after you&apos;re signed in.
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Name */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">
                Name <span className="text-slate-500">(optional)</span>
              </label>
              <input
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-emerald-500"
                placeholder="Default Landlord"
              />
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-emerald-500"
                placeholder="you@example.com"
              />
            </div>

            {/* Password + show/hide toggle */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">
                Password
              </label>
              <div className="relative">
                <input
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-10 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-emerald-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[11px] text-slate-400 hover:text-slate-200"
                >
                  {passwordVisible ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Use at least 8 characters. You&apos;ll use this to sign in to your landlord dashboard.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {loading ? 'Creating account…' : 'Create landlord account'}
            </button>
          </form>

          <p className="mt-4 text-[11px] text-slate-500">
            Already have an account?{' '}
            <Link href="/landlord/login" className="text-emerald-300 hover:text-emerald-200">
              Log in.
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
