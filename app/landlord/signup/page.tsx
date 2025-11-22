'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

export default function LandlordSignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!email || !password) {
        throw new Error('Email and password are required.');
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) throw signUpError;

      const userEmail = signUpData.user?.email || email;

      // Create landlord row if it doesn't exist yet
      const { error: landlordError } = await supabase
        .from('landlords')
        .insert({
          email: userEmail,
          name: fullName || null,
        })
        .select('id')
        .single();

      // If duplicate email or similar, just log and continue.
      if (landlordError) {
        console.warn('Landlord insert error (may already exist):', landlordError);
      }

      // Go to landlord dashboard; gate will handle subscription redirect.
      router.push('/landlord');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create landlord account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl space-y-5">
        <div className="space-y-2">
          <button
            type="button"
            className="text-[11px] text-slate-500 hover:text-emerald-300"
            onClick={() => router.push('/')}
          >
            ← Back to homepage
          </button>
          <h1 className="text-lg font-semibold text-slate-50">
            Create your landlord account
          </h1>
          <p className="text-[12px] text-slate-400">
            This account lets you log in to the RentZentro landlord dashboard.
            You&apos;ll set up your subscription from inside the app after
            you&apos;re signed in.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1 text-sm">
            <label className="block text-slate-200" htmlFor="fullName">
              Name (optional)
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Default Landlord"
            />
          </div>

          <div className="space-y-1 text-sm">
            <label className="block text-slate-200" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="space-y-1 text-sm">
            <label className="block text-slate-200" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Create a password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account…' : 'Create landlord account'}
          </button>
        </form>

        <p className="text-[11px] text-slate-500">
          Already have an account?{' '}
          <Link
            href="/landlord/login"
            className="text-emerald-400 hover:text-emerald-300"
          >
            Log in
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
