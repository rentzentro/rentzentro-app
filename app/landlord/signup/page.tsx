'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

export default function LandlordSignupPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);

    try {
      // 1) Create auth user
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        console.error('signUp error', signUpError);
        setError(signUpError.message || 'Unable to create account.');
        setLoading(false);
        return;
      }

      // 2) Make sure we have a session (if email confirmation is off this will succeed)
      await supabase.auth.signInWithPassword({ email, password }).catch(() => {
        // If this fails but user already has a session, we can still continue.
      });

      // 3) Insert landlord row for this user.
      //    RLS will ensure email must match auth.jwt()->>email.
      const { error: insertError } = await supabase
        .from('landlords')
        .insert({
          name: name || null,
          email,
        });

      // If a row already exists for this email, Postgres sends a unique-violation
      // error (code 23505). In that case we can safely ignore and continue.
      if (insertError && (insertError as any).code !== '23505') {
        console.error('insert landlord error', insertError);
        setError(
          insertError.message || 'Unable to create landlord account record.'
        );
        setLoading(false);
        return;
      }

      // 4) Go to landlord dashboard
      router.push('/landlord');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Unexpected error creating account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 px-6 py-7 shadow-lg">
        {/* Back link */}
        <Link
          href="/"
          className="text-[11px] text-slate-400 hover:text-emerald-300"
        >
          ← Back to homepage
        </Link>

        {/* Header */}
        <div className="mt-3 mb-5">
          <h1 className="text-xl font-semibold text-slate-50">
            Create your landlord account
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            This account lets you log in to the RentZentro landlord dashboard.
            You&apos;ll start your subscription from inside the app after
            you&apos;re signed in.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-300">
              Name <span className="text-slate-500">(optional)</span>
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              placeholder="Default Landlord"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-300">Email</label>
            <input
              type="email"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-300">Password</label>
            <input
              type="password"
              required
              minLength={6}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              placeholder="Choose a secure password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-[11px] text-slate-500">
              At least 6 characters. You&apos;ll use this to log in to your
              landlord dashboard.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? 'Creating account…' : 'Create landlord account'}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-4 text-[11px] text-slate-500">
          Already have an account?{' '}
          <Link
            href="/landlord/login"
            className="text-emerald-300 hover:text-emerald-200"
          >
            Log in.
          </Link>
        </p>
      </div>
    </main>
  );
}
