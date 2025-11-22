'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../supabaseClient';

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
          .select('*')
          .eq('email', email)
          .maybeSingle();

        if (landlordError) throw landlordError;
        if (!data) throw new Error('Landlord record not found.');

        setLandlord(data);
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
        headers: { 'Content-Type': 'application/json' },
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
              Account Settings
            </h1>
            <p className="text-slate-400 text-xs">
              Manage your subscription & account preferences.
            </p>
          </div>

          <button
            onClick={handleLogOut}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
          >
            Log out
          </button>
        </div>

        {/* Subscription Status */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm space-y-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            Subscription
          </p>

          {landlord.subscription_status ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-50 font-medium">
                Status:{' '}
                <span className="text-emerald-300">
                  {landlord.subscription_status}
                </span>
              </p>

              <p className="text-xs text-slate-400">
                Next billing date:{' '}
                <span className="text-slate-200">
                  {formatDate(landlord.subscription_current_period_end)}
                </span>
              </p>

              <p className="text-xs text-slate-500">
                You&apos;re subscribed to the RentZentro Landlord Plan
                ($29.95/mo).
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-400">
                You are not subscribed yet.
              </p>

              <button
                onClick={handleStartSubscription}
                disabled={startingCheckout}
                className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-60"
              >
                {startingCheckout
                  ? 'Starting checkout…'
                  : 'Subscribe for $29.95/mo'}
              </button>

              <p className="text-xs text-slate-500">
                Subscription unlocks full payment features, unlimited units,
                tenant messaging, and more.
              </p>
            </div>
          )}
        </section>

        {/* Back to portal */}
        <div className="pt-4">
          <Link
            href="/landlord"
            className="text-xs text-slate-500 hover:text-emerald-300"
          >
            ← Back to portal
          </Link>
        </div>
      </div>
    </main>
  );
}
