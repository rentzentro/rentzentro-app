'use client';

import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LandlordSignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      const user = authData.user;
      if (!user) throw new Error('Signup failed. Please try again.');

      // 2. Insert landlord row
      const { error: landlordError } = await supabase.from('landlords').insert({
        email,
        user_id: user.id,
        stripe_connect_account_id: null,
        stripe_connect_onboarded: false,
      });

      if (landlordError) throw landlordError;

      // 3. Redirect to payout setup
      router.push('/landlord/complete-setup');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to sign up. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md space-y-6 bg-slate-900/80 border border-slate-700 rounded-2xl p-6 shadow-xl">
        <h1 className="text-xl font-semibold text-slate-50">
          Landlord sign up
        </h1>
        <p className="text-sm text-slate-400">
          Create your account to start collecting rent.
        </p>

        {error && (
          <div className="rounded-md border border-red-500/50 bg-red-500/10 text-red-200 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-50"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-50"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-emerald-500 text-slate-950 py-2 font-semibold text-sm hover:bg-emerald-400 disabled:opacity-50"
          >
            {loading ? 'Signing up…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-4">
          Already have an account?{' '}
          <Link href="/landlord/login" className="text-emerald-400 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
