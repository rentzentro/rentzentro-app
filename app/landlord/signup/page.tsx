'use client';

import { useState } from 'react';
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
      // 1) Create Supabase auth user
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name || 'Landlord',
              role: 'landlord',
            },
          },
        });

      if (signUpError) throw signUpError;

      const user = signUpData.user;
      if (!user) {
        throw new Error('Account was created, but no user was returned.');
      }

      // 2) Upsert landlord row with INACTIVE subscription
      const { error: landlordError } = await supabase
        .from('landlords')
        .upsert(
          {
            // Match by email so we don't create duplicates if they re-sign up
            email: user.email,
            name: name || 'Default Landlord',
            subscription_status: 'inactive', // <-- IMPORTANT
          },
          {
            onConflict: 'email', // make sure landlords.email has a unique constraint
          }
        );

      if (landlordError) {
        console.error('Error creating landlord row:', landlordError);
        throw new Error(
          'Your account was created, but we could not finish the landlord setup. Please contact support.'
        );
      }

      // 3) Send them DIRECTLY to settings / subscription
      router.push('/landlord/settings');
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Something went wrong while creating your account. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBackHome = () => {
    router.push('/');
  };

  const handleLoginInstead = () => {
    router.push('/landlord/login');
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl space-y-6">
        <button
          type="button"
          onClick={handleBackHome}
          className="text-[11px] text-slate-500 hover:text-emerald-300"
        >
          ← Back to homepage
        </button>

        <div>
          <h1 className="text-xl font-semibold text-slate-50">
            Create your landlord account
          </h1>
          <p className="mt-1 text-[12px] text-slate-400">
            This account lets you log in to the RentZentro landlord dashboard.
            You&apos;ll activate your{' '}
            <span className="font-semibold text-emerald-300">$29.95/mo</span>{' '}
            subscription on the next step.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/60 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-[12px] text-slate-300">
              Name (optional)
            </label>
            <input
              type="text"
              placeholder="Your name or business"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[12px] text-slate-300">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[12px] text-slate-300">
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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

        <div className="text-center text-[12px] text-slate-400">
          Already have an account?{' '}
          <button
            type="button"
            onClick={handleLoginInstead}
            className="text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline"
          >
            Log in.
          </button>
        </div>

        <p className="mt-1 text-[10px] text-slate-500 text-center">
          By creating an account, you agree to the RentZentro{' '}
          <a
            href="/terms"
            className="text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline"
          >
            Terms
          </a>{' '}
          and{' '}
          <a
            href="/privacy"
            className="text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline"
          >
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </main>
  );
}
