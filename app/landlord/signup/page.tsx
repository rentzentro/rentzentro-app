'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

export default function LandlordSignupPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      // 1) Create Supabase auth user
      const {
        data: signUpData,
        error: signUpError,
      } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || null,
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      const user = signUpData.user;
      if (!user) {
        throw new Error('Account was created, but user information is missing.');
      }

      // 2) Create landlord row tied to this user via user_id (default auth.uid())
      const { error: landlordError } = await supabase
        .from('landlords')
        .insert({
          name: name || null,
          email,
          // user_id will be filled automatically by default auth.uid()
        })
        .single();

      if (landlordError) {
        console.error('Landlord insert error:', landlordError);
        throw new Error(
          'Your account was created, but we could not finish the landlord setup. Please contact support.'
        );
      }

      // 3) Send them to subscription/settings page, NOT the dashboard
      router.push('/landlord/settings');
    } catch (err: any) {
      console.error('Landlord signup error:', err);
      setError(
        err?.message ||
          'Something went wrong while creating your landlord account. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 px-6 py-7 shadow-xl">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mb-4 text-xs text-slate-400 hover:text-emerald-300"
        >
          ← Back to homepage
        </button>

        <h1 className="text-xl font-semibold text-slate-50">
          Create your landlord account
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          This account lets you log in to the RentZentro landlord dashboard. You&apos;ll
          activate your <span className="text-emerald-300 font-semibold">$29.95/mo</span>{' '}
          subscription on the next step.
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/70 bg-red-500/10 px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">
              Name (optional)
            </label>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400"
              placeholder="Your name or business"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400"
              placeholder="Create a secure password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account…' : 'Create landlord account'}
          </button>
        </form>

        <p className="mt-4 text-[11px] text-slate-400 text-center">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => router.push('/landlord/login')}
            className="text-emerald-300 hover:underline"
          >
            Log in.
          </button>
        </p>

        <p className="mt-4 text-[10px] text-slate-500 text-center">
          By creating an account, you agree to the RentZentro{' '}
          <a
            href="/terms"
            className="text-emerald-300 hover:underline"
          >
            Terms
          </a>{' '}
          and{' '}
          <a
            href="/privacy"
            className="text-emerald-300 hover:underline"
          >
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </main>
  );
}
