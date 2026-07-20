'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../supabaseClient';
import signupValidation from './signupValidation';
import referralUtils from '../../lib/referrals';

export default function LandlordSignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const { sanitizeReferralCode } = referralUtils as {
    sanitizeReferralCode: (value: string | null) => string | null;
  };

  const referralCode = sanitizeReferralCode(searchParams.get('ref'));

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const { validateLandlordSignupInput } = signupValidation;
    const validation = validateLandlordSignupInput({ email, password, confirmPassword });

    if (!validation.ok) {
      setError(validation.message || 'Unable to create your landlord account. Please try again.');
      return;
    }

    const normalizedEmail = validation.normalizedEmail as string;

    setLoading(true);

    try {
      // 1) Create Supabase auth user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: referralCode
            ? {
                referral_code_used: referralCode,
                referral_source: 'landlord_referral_link',
              }
            : undefined,
        },
      });

      if (signUpError) throw signUpError;

      const user = data.user;

      if (!user) {
        throw new Error('We could not complete signup. Please try again in a moment.');
      }

      // 2) Insert landlord row
      const { data: insertedLandlord, error: insertError } = await supabase
        .from('landlords')
        .insert([
          {
            email: normalizedEmail,
            user_id: user.id,
            trial_active: false,
            trial_end: null,
            subscription_active: false,
          },
        ])
        .select('id')
        .single();

      if (insertError || !insertedLandlord?.id) {
        console.error('Error inserting landlord row:', insertError);
        throw new Error(
          'Your account was created, but we could not finish landlord setup. Please contact support.'
        );
      }

      fetch('/api/welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
        }),
      }).catch((welcomeEmailErr) => {
        console.warn('Welcome email was not sent:', welcomeEmailErr);
      });

      if (referralCode) {
        fetch('/api/referrals/attribution', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            landlordId: insertedLandlord.id,
            userId: user.id,
            referralCode,
            source: 'landlord_signup_referral',
          }),
        }).catch((referralErr) => {
          console.warn('Referral attribution was not recorded:', referralErr);
        });
      }

      // 3) Redirect to dashboard. The forever-free unit handles initial access.
      setInfo(
        'Account created! Your forever-free unit is ready. Redirecting you to your landlord dashboard…'
      );

      router.push('/landlord?signup=1');
    } catch (err: any) {
      console.error(err);
      const { mapSignupErrorMessage } = signupValidation;
      setError(mapSignupErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rz-auth-shell flex items-center justify-center">
      <div className="rz-auth-card">
        <div className="mb-4">
          <Link href="/" className="rz-btn-nav">
            ← Back to homepage
          </Link>
        </div>

        <h1 className="text-lg font-semibold text-slate-50 mb-1">
          Create your landlord account
        </h1>

        <p className="text-xs text-slate-400 mb-1">
          Start collecting rent online and managing your properties in minutes.
        </p>

        <p className="text-[11px] text-emerald-300 mb-4">
          One unit forever free. No card required.
        </p>

        {referralCode && (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-[11px] text-emerald-100">
            Referral applied: <span className="font-semibold">{referralCode}</span>
          </div>
        )}

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
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Email</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rz-field"
                required
              />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rz-field pr-16"
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
          </div>

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
                className="rz-field pr-16"
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

          <button
            type="submit"
            disabled={loading}
            className="rz-btn-primary mt-3"
          >
            {loading ? 'Creating your account…' : 'Create landlord account'}
          </button>
        </form>

        <p className="mt-4 text-[11px] text-slate-400 text-center">
          Already have a landlord account?{' '}
          <Link
            href="/landlord/login"
            className="text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline"
          >
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}
