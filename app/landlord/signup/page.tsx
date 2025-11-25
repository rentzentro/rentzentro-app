'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

export default function LandlordSignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError('Please enter an email address.');
      return;
    }

    if (!password) {
      setError('Please create a password.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please double-check.');
      return;
    }

    setLoading(true);

    try {
      // 1) Create auth user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) {
        console.error('Landlord signup error:', signUpError);
        setError(signUpError.message || 'Failed to create account.');
        return;
      }

      const user = data.user;
      if (!user) {
        setError(
          'We could not finish creating your account. Please check your email for a confirmation link and try again.'
        );
        return;
      }

      // 2) Make sure a landlord row exists for this user
      const { error: landlordError } = await supabase
        .from('landlords')
        .insert({
          email: email.trim(),
          user_id: user.id,
        });

      if (landlordError) {
        console.error('Error inserting landlord row:', landlordError);
        // not fatal for user – they can still continue to subscription
      }

      setSuccess('Account created! Next step: start your subscription…');

      // 3) Send them straight to subscription – no free dashboard
      router.push('/landlord/subscription');
    } catch (err: any) {
      console.error('Unexpected landlord signup error:', err);
      setError(
        err?.message ||
          'Something went wrong while creating your account. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 shadow-xl p-6 space-y-6">
        {/* Brand / header */}
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-400">
            RentZentro • Landlord
          </p>
          <h1 className="text-xl font-semibold text-slate-50">
            Create your landlord account
          </h1>
          <p className="text-sm text-slate-400">
            Sign up to track units, invite tenants, and accept secure card
            payments for rent.
          </p>
        </div>

        {/* Alerts */}
        {(error || success) && (
          <div
            className={`rounded-xl border px-3 py-2 text-xs ${
              error
                ? 'border-red-500/70 bg-red-500/10 text-red-200'
                : 'border-emerald-500/70 bg-emerald-500/10 text-emerald-200'
            }`}
          >
            {error || success}
          </div>
        )}

        {/* Signup form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {/* Email */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-200">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="you@example.com"
            />
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-200">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 pr-10 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Create a strong password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-2 flex items-center text-xs text-slate-400 hover:text-emerald-300"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              At least 8 characters. Use a mix of letters, numbers, and symbols
              if possible.
            </p>
          </div>

          {/* Confirm password */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-200">
              Confirm password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 pr-10 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Re-enter your password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute inset-y-0 right-2 flex items-center text-xs text-slate-400 hover:text-emerald-300"
                aria-label={
                  showConfirmPassword
                    ? 'Hide confirm password'
                    : 'Show confirm password'
                }
              >
                {showConfirmPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating your account…' : 'Create landlord account'}
            </button>
          </div>
        </form>

        {/* Footer / link to login */}
        <div className="pt-2 border-t border-slate-800/60">
          <p className="mt-3 text-xs text-slate-400">
            Already have a RentZentro landlord account?{' '}
            <Link
              href="/landlord/login"
              className="font-medium text-emerald-400 hover:text-emerald-300"
            >
              Log in here
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
