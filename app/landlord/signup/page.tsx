'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../supabaseClient';

export default function LandlordSignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // --- PROMO CONFIG (single source of truth) ---
  // Free access through end of day Jan 31, 2026 (UTC).
  // IMPORTANT: trial_end should match what your access gates check against.
  const PROMO_END_YMD = '2026-01-31';
  const PROMO_END_ISO = '2026-01-31T23:59:59Z';

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please double-check.');
      return;
    }

    if (password.length < 8) {
      setError('Password should be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      // 1) Create Supabase auth user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) throw signUpError;

      const user = data.user;

      if (!user) {
        throw new Error(
          'We could not complete signup. Please try again in a moment.'
        );
      }

      // --- PROMO LOGIC: Active until Jan 31, 2026 (end of day UTC) ---
      // Anyone who signs up before promo end gets free access through PROMO_END_YMD.
      const now = new Date();
      const promoEndsAt = new Date(PROMO_END_ISO);
      const isPromoPeriod = now <= promoEndsAt;

      const trialEndValue = isPromoPeriod ? PROMO_END_YMD : null;

      // 2) Insert landlord row linked to this auth user
      // NOTE: subscription_status is controlled by Stripe webhook logic.
      // We set trial flags here for promo access.
      const { error: insertError } = await supabase.from('landlords').insert([
        {
          email,
          user_id: user.id,
          trial_active: isPromoPeriod,
          trial_end: trialEndValue,
          // Keep legacy flag if your DB still has it, but access should be driven by
          // subscription_status + trial_active/trial_end (as in your dashboard code).
          subscription_active: false,
          // Optional: if your table uses subscription_status default null, leave it.
          // subscription_status: null,
        },
      ]);

      if (insertError) {
        console.error('Error inserting landlord row:', insertError);
        throw new Error(
          'Your account was created, but we could not finish landlord setup. Please contact support.'
        );
      }

      // 3) Redirect based on whether they are in the promo period
      if (isPromoPeriod) {
        setInfo(
          'Account created! You have free access until January 31st. Redirecting you to your landlord dashboard…'
        );
        router.push('/landlord');
      } else {
        setInfo('Account created! Redirecting you to subscription…');
        router.push('/landlord/subscription');
      }
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Unable to create your landlord account. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-sm">
        {/* Back button */}
        <div className="mb-4">
          <Link
            href="/"
            className="text-[11px] text-slate-500 hover:text-emerald-400"
          >
            ← Back to homepage
          </Link>
        </div>

        <h1 className="text-lg font-semibold text-slate-50 mb-1">
          Create your landlord account
        </h1>
        <p className="text-xs text-slate-400 mb-1">
          Start your RentZentro landlord plan and connect payouts for rent
          collection.
        </p>
        <p className="text-[11px] text-emerald-300 mb-4">
          Promo: Sign up now and get free access until January 31st. No card
          required until you&apos;re ready to subscribe.
        </p>

        {error && (
          <div className="mb-3 rounded-xl bg-rose-950/40 border border-rose-500/40 px-3 py-2 text-xs text-rose-100">
            {error}
          </div>
        )}
        {info && (
          <div className="mb-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 px-3 py-2 text-xs text-emerald-100">
            {info}
          </div>
        )}

        <form onSubmit={handleSignUp} className="space-y-3 text-sm">
          {/* Email */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:ring-emerald-500"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 pr-16 text-sm text-slate-50 focus:ring-emerald-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-2 flex items-center text-[11px] text-slate-400 hover:text-slate-200"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              Use at least 8 characters. For extra security, include numbers and
              symbols.
            </p>
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Confirm password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 pr-16 text-sm text-slate-50 focus:ring-emerald-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                className="absolute inset-y-0 right-2 flex items-center text-[11px] text-slate-400 hover:text-slate-200"
              >
                {showConfirm ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="mt-3 w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? 'Creating your account…' : 'Create landlord account'}
          </button>
        </form>

        {/* Login link */}
        <p className="mt-4 text-[11px] text-slate-400 text-center">
          Already have a landlord account?{' '}
          <Link
            href="/landlord/login"
            className="text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline"
          >
            Sign in here
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
