'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

export default function TeamLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password;

    if (!trimmedEmail || !trimmedPassword) {
      setError('Please enter both email and password.');
      return;
    }

    setSubmitting(true);

    try {
      // 1) Sign in with Supabase – same auth backend for landlords + team
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (signInError) {
        throw signInError;
      }

      // 2) On success, just send them to the landlord dashboard.
      // Your RLS + team logic already controls what they see.
      router.push('/landlord');
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Something went wrong signing you in. Please double-check your email and password.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const goHome = () => {
    router.push('/');
  };

  return (
    <main className="rz-auth-shell">
      <div className="mx-auto max-w-md space-y-6">
        {/* Header */}
        <header className="space-y-2">
          <button
            type="button"
            onClick={goHome}
            className="text-[11px] text-slate-500 hover:text-emerald-300"
          >
            ← Back to RentZentro
          </button>
          <h1 className="text-xl font-semibold text-slate-50">
            Team member sign in
          </h1>
          <p className="text-sm text-slate-400">
            Log in with the same email that received your RentZentro team invite.
          </p>
        </header>

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Form */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-sm space-y-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Team member login
            </p>
            <p className="mt-1 text-sm text-slate-200">
              Use your email and password to access your landlord’s RentZentro dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="block text-slate-300">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rz-field text-xs placeholder:text-slate-500"
                placeholder="name@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-slate-300">
                Password <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rz-field text-xs placeholder:text-slate-500"
                placeholder="Your RentZentro password"
                autoComplete="current-password"
                required
              />
              <p className="mt-1 text-[11px] text-slate-500">
                If you haven&apos;t created a password yet, open your team invite email
                and follow the link to set it up first.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="rz-btn-primary mt-2 text-xs"
            >
              {submitting ? 'Signing you in…' : 'Sign in as team member'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
