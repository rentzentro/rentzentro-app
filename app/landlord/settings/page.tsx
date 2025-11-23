'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import Link from 'next/link';

// ---------- Types ----------
type LandlordRow = {
  id: number;
  email: string;
  name: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  subscription_current_period_end: string | null;
};

// ---------- Helpers ----------
const formatDate = (iso: string | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// ---------- Component ----------
export default function LandlordSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [startingCheckout, setStartingCheckout] = useState(false);

  // Load logged-in landlord
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const auth = await supabase.auth.getUser();
        const email = auth.data.user?.email;
        if (!email) throw new Error('Unable to load landlord account.');

        const { data, error: landlordError } = await supabase
          .from('landlords')
          .select(
            'id, email, name, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end'
          )
          .eq('email', email)
          .maybeSingle();

        if (landlordError) throw landlordError;
        if (!data) throw new Error('Landlord record not found.');

        setLandlord(data as LandlordRow);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Unable to load settings.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleStartSubscription = async () => {
    if (!landlord) return;
    setStartingCheckout(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/subscription/checkout', {
        method: 'POST',
        body: JSON.stringify({ landlordId: landlord.id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.error || 'Unable to start subscription checkout.'
        );
      }

      const data = await res.json();
      if (!data.url) throw new Error('Missing checkout URL.');

      window.location.href = data.url;
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to begin subscription checkout.');
    } finally {
      setStartingCheckout(false);
    }
  };

  const handleLogOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/landlord/login';
  };

  // ---------- Render ----------
  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Loading settings…</p>
      </main>
    );
  }

  if (!landlord) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-red-400 text-sm">
          {error || 'Unable to load account.'}
        </p>
      </main>
    );
  }

  const isSubscribed =
    landlord.subscription_status &&
    landlord.subscription_status.toLowerCase() === 'active';

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-6">
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

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-50">
              Account settings
            </h1>
            <p className="text-slate-400 text-xs">
              Manage your account details and subscription.
            </p>
          </div>

          <button
            onClick={handleLogOut}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
          >
            Log out
          </button>
        </div>

        {/* Subscription warning – ONLY when not subscribed */}
        {!isSubscribed && (
          <div className="rounded-2xl border border-amber-500/70 bg-amber-950/40 px-4 py-3 text-xs text-amber-100">
            <p className="font-semibold">
              Subscription required to use RentZentro landlord tools.
            </p>
            <p className="mt-1">
              Click <span className="font-semibold">“Subscribe for $29.95/mo”</span>{' '}
              below to start your RentZentro Landlord Plan and unlock the full
              landlord dashboard.
            </p>
          </div>
        )}

        {/* ACCOUNT CARD */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm space-y-2">
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            Account
          </p>

          <div className="mt-1 flex flex-col gap-1 text-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] text-slate-500">Landlord profile</p>
                <p className="text-sm font-medium text-slate-50">
                  {landlord.name || 'Default Landlord'}
                </p>
              </div>
              <div className="mt-2 sm:mt-0 text-left sm:text-right">
                <p className="text-[11px] text-slate-500">Email</p>
                <p className="text-sm font-medium text-slate-50">
                  {landlord.email}
                </p>
              </div>
            </div>

            <p className="mt-3 text-[11px] text-slate-500">
              In a future update you&apos;ll be able to change your profile
              info and add additional team members from this screen.
            </p>
          </div>
        </section>

        {/* SUBSCRIPTION CARD */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm space-y-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            Subscription
          </p>

          {isSubscribed ? (
            <>
              <p className="text-sm">
                Status:{' '}
                <span className="font-semibold text-emerald-300">active</span>
              </p>
              <p className="text-xs text-slate-400">
                Next billing date:{' '}
                <span className="text-slate-200">
                  {formatDate(landlord.subscription_current_period_end)}
                </span>
              </p>
              <p className="text-xs text-slate-500">
                You&apos;re subscribed to the{' '}
                <span className="font-medium">
                  RentZentro Landlord Plan ($29.95/mo)
                </span>
                . Manage billing details in your Stripe customer portal if
                enabled, or contact support to make changes.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-50">
                Status:{' '}
                <span className="font-semibold text-amber-300">
                  not subscribed
                </span>
              </p>
              <button
                onClick={handleStartSubscription}
                disabled={startingCheckout}
                className="mt-3 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-60"
              >
                {startingCheckout
                  ? 'Starting checkout…'
                  : 'Subscribe for $29.95/mo'}
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Subscription unlocks full payment features, unlimited units,
                tenant messaging, maintenance tracking, and more.
              </p>
            </>
          )}
        </section>

        {/* Back to portal */}
        <div className="pt-2">
          <Link
            href="/landlord"
            className="text-xs text-slate-500 hover:text-emerald-300"
          >
            ← Back to landlord dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
