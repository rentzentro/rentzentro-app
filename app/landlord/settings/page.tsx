'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

type LandlordRow = {
  id: number;
  email: string;
  name: string | null;
  stripe_connect_account_id: string | null;
  stripe_connect_onboarded: boolean | null;
};

export default function LandlordSettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [connectingStripe, setConnectingStripe] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError || !authData.user?.email) {
          router.push('/landlord/login');
          return;
        }

        const user = authData.user;

        // Load landlord by user_id first
        let { data: landlordRow, error: landlordError } = await supabase
          .from('landlords')
          .select(
            'id, email, name, stripe_connect_account_id, stripe_connect_onboarded'
          )
          .eq('user_id', user.id)
          .maybeSingle();

        if (landlordError) {
          console.error('Error loading landlord by user_id:', landlordError);
          throw new Error('Unable to load landlord account.');
        }

        // Fallback by email (older rows)
        if (!landlordRow) {
          const byEmail = await supabase
            .from('landlords')
            .select(
              'id, email, name, stripe_connect_account_id, stripe_connect_onboarded'
            )
            .eq('email', user.email)
            .maybeSingle();

          if (byEmail.error) {
            console.error('Error loading landlord by email:', byEmail.error);
            throw new Error('Unable to load landlord account.');
          }

          landlordRow = byEmail.data;
        }

        if (!landlordRow) {
          throw new Error('Landlord account not found.');
        }

        setLandlord(landlordRow as LandlordRow);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ||
            'Failed to load your landlord settings. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const handleStripeConnect = async () => {
    if (!landlord) return;
    setConnectingStripe(true);
    setError(null);
    setSuccess(null);

    try {
      // IMPORTANT: this route is /landlord/stripe-connect, NOT /api/...
      const res = await fetch('/landlord/stripe-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landlordId: landlord.id }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.url) {
        console.error('Stripe connect error:', data);
        throw new Error(
          data?.error ||
            'Unable to start Stripe payouts setup. Please try again.'
        );
      }

      // Redirect landlord to Stripe-hosted onboarding / dashboard
      window.location.href = data.url as string;
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Something went wrong while opening Stripe. Please try again.'
      );
    } finally {
      setConnectingStripe(false);
    }
  };

  const handleBackToDashboard = () => {
    router.push('/landlord');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/landlord/login');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading landlord settings…</p>
      </main>
    );
  }

  if (!landlord) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-slate-900/80 border border-slate-700 p-6 shadow-xl space-y-4">
          <p className="text-sm text-red-400">
            {error ||
              'We could not find a landlord profile for this account. Please contact support.'}
          </p>
          <button
            onClick={handleBackToDashboard}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
          >
            Back to dashboard
          </button>
        </div>
      </main>
    );
  }

  const payoutsConnected =
    !!landlord.stripe_connect_account_id && !!landlord.stripe_connect_onboarded;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Header / breadcrumb */}
        <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="md:max-w-xl">
            <div className="text-xs text-slate-500 flex gap-1 items-center">
              <Link href="/landlord" className="hover:text-emerald-400">
                Landlord
              </Link>
              <span>/</span>
              <span className="text-slate-300">Settings</span>
            </div>
            <h1 className="mt-1 text-lg font-semibold text-slate-50">
              Landlord settings
            </h1>
            <p className="text-[11px] text-slate-400">
              Connect payouts so rent can be deposited to your bank, then manage
              your RentZentro plan and billing.
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Signed in as{' '}
              <span className="text-slate-300">
                {landlord.name ? `${landlord.name} · ${landlord.email}` : landlord.email}
              </span>
            </p>
          </div>

          {/* Buttons: stack on mobile, row on md+ */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
            <button
              type="button"
              onClick={handleBackToDashboard}
              className="text-xs px-3 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            >
              Back to dashboard
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs px-3 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        </header>

        {(success || error) && (
          <div
            className={`rounded-xl border px-4 py-2 text-sm ${
              success
                ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/60 bg-red-500/10 text-red-200'
            }`}
          >
            {success || error}
          </div>
        )}

        {/* Payouts card */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Payouts
              </p>
              <h2 className="mt-1 text-sm font-semibold text-slate-50">
                Connect payouts to receive rent
              </h2>
            </div>
            <span
              className={
                'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ' +
                (payoutsConnected
                  ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/40'
                  : 'bg-amber-500/15 text-amber-200 border border-amber-500/40')
              }
            >
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current" />
              {payoutsConnected
                ? 'Payouts connected'
                : 'Payouts setup required'}
            </span>
          </div>

          <p className="text-xs text-slate-400">
            RentZentro uses Stripe Connect to send tenant rent payments directly
            to your bank account. We never hold your funds; Stripe deposits them
            to you based on your payout schedule. Until payouts are connected,
            tenants can&apos;t successfully pay rent through RentZentro.
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleStripeConnect}
              disabled={connectingStripe}
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {connectingStripe
                ? 'Opening Stripe…'
                : payoutsConnected
                ? 'Manage payouts in Stripe'
                : 'Connect payouts with Stripe'}
            </button>
            <p className="text-[11px] text-slate-500 sm:flex-1">
              Stripe will open in a new page where you can add or update your
              bank account, view payouts, and manage tax forms.
            </p>
          </div>
        </section>

        {/* Subscription / billing card */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Subscription
              </p>
              <h2 className="mt-1 text-sm font-semibold text-slate-50">
                RentZentro landlord plan
              </h2>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Manage your RentZentro landlord subscription, update your billing
            details, or cancel your plan at any time. If you&apos;re on a free
            access promotion, you won&apos;t be billed until you start a paid
            subscription from the next screen.
          </p>

          <div className="mt-3">
            <Link
              href="/landlord/subscription"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800"
            >
              Open subscription &amp; billing
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
