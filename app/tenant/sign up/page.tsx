'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

export default function TenantSignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage('Account created. You can log in now.');
    setLoading(false);
    router.push('/tenant/login');
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <Link href="/" className="text-xs text-slate-400 hover:text-slate-200">
          ← Back to home
        </Link>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h1 className="text-xl font-semibold">Tenant sign up</h1>
          <p className="text-xs text-slate-400">
            Use the same email your landlord has on file for you.
          </p>

          {error && (
            <div className="rounded-xl bg-red-900/40 border border-red-500/60 px-3 py-2 text-xs text-red-100">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-xl bg-emerald-900/30 border border-emerald-500/60 px-3 py-2 text-xs text-emerald-100">
              {message}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Email</label>
              <input
                type="email"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Password</label>
              <input
                type="password"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Confirm password</label>
              <input
                type="password"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-medium px-4 py-2 disabled:opacity-60 mt-2"
            >
              {loading ? 'Creating account...' : 'Sign up'}
            </button>
          </form>

          <p className="text-xs text-slate-400">
            Already have an account?{' '}
            <Link href="/tenant/login" className="text-emerald-400 hover:text-emerald-300">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
