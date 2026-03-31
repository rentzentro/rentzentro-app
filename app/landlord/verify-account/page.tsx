'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../supabaseClient';

type ViewState = 'loading' | 'no-landlord' | 'redirecting' | 'error';

const parseDateOnlySafe = (value: string | null | undefined): Date | null => {
  if (!value) return null;

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!y || !mo || !d) return null;
    return new Date(y, mo - 1, d);
  }

  const dt = new Date(value);
  if (isNaN(dt.getTime())) return null;

  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
};

const todayDateOnly = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

export default function LandlordVerifyAccountPage() {
  const router = useRouter();

  const [state, setState] = useState<ViewState>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setState('loading');
        setError(null);

        // 1) Get current auth user
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError || !authData.user) {
          console.error('Verify landlord: no auth user', authError);
          router.push('/landlord/login');
          return;
        }

        const user = authData.user;

        // 2) Load landlord row by user_id
        const { data: landlord, error: landlordError } = await supabase
          .from('landlords')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (landlordError) {
          console.error('Verify landlord: landlord error', landlordError);
          setError(
            landlordError.message ||
              'Unable to load landlord account. Please try again.'
          );
          setState('error');
          return;
        }

        if (!landlord) {
          setState('no-landlord');
          return;
        }

        const l: any = landlord;

        // 3) Check subscription status
        const rawStatus: string = (
          l.stripe_subscription_status ||
          l.subscription_status ||
          ''
        )
          .toString()
          .toLowerCase();

        const isSubscribed: boolean =
          rawStatus === 'active' ||
          rawStatus === 'trialing' ||
          rawStatus === 'active_cancel_at_period_end' ||
          l.is_subscribed === true ||
          l.subscription_active === true;

        // 4) Check rolling trial
        const trialEnd = parseDateOnlySafe(l.trial_end);
        const isTrialActive =
          l.trial_active === true &&
          !!trialEnd &&
          !Number.isNaN(trialEnd.getTime()) &&
          trialEnd >= todayDateOnly();

        // 5) Allow if subscribed OR active trial
        if (!isSubscribed && !isTrialActive) {
          setState('redirecting');
          router.push('/landlord/subscription');
          return;
        }

        // 6) All good → send to dashboard
        setState('redirecting');
        router.push('/landlord');
      } catch (err: any) {
        console.error('Verify landlord: unexpected error', err);
        setError(
          err?.message ||
            'Unexpected error while checking your landlord account.'
        );
        setState('error');
      }
    };

    run();
  }, [router]);

  if (state === 'loading' || state === 'redirecting') {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-xl text-center">
          <p className="text-sm text-slate-100 mb-2">
            Checking your landlord account…
          </p>
          <p className="text-xs text-slate-400">
            This only takes a moment. We&apos;re verifying your subscription and
            account status.
          </p>
        </div>
      </main>
    );
  }

  if (state === 'no-landlord') {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl text-center space-y-4">
          <h1 className="text-lg font-semibold text-red-400">
            Landlord account not found.
          </h1>
          <p className="text-sm text-slate-300">
            The email you signed in with isn&apos;t connected to a RentZentro
            landlord profile yet.
          </p>
          <p className="text-xs text-slate-500">
            If you&apos;re a landlord, you can create your account in just a
            minute.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={() => router.push('/landlord/signup')}
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Create landlord account
            </button>
            <button
              type="button"
              onClick={() => router.push('/landlord/login')}
              className="text-xs text-slate-400 hover:text-emerald-300"
            >
              ← Back to landlord login
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl text-center space-y-4">
        <h1 className="text-lg font-semibold text-red-400">
          Something went wrong.
        </h1>
        <p className="text-sm text-slate-300">
          We couldn&apos;t verify your landlord account right now.
        </p>
        {error && (
          <p className="text-xs text-rose-200 bg-rose-950/40 border border-rose-500/40 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={() => router.push('/landlord/login')}
            className="inline-flex items-center justify-center rounded-full bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-50 hover:bg-slate-700"
          >
            Back to landlord login
          </button>
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-emerald-300"
          >
            ← Back to homepage
          </Link>
        </div>
      </div>
    </main>
  );
}