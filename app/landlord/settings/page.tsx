'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();

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
    router.push('/landlord/login');
  };

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
        <div className="max-w-md rounded-2xl bg-slate-900/80 border border-slate-800 px-5 py-4">
          <p className="text-xs text-red-400">
            {error || 'Unable to load landlord account.'}
          </p>
          <button
            onClick={handleLogOut}
            className="mt-3 text-xs text-emerald-300 hover:text-emerald-200"
          >
            Back to login
          </button>
        </div>
      </main>
    );
  }

  const isActive = landlord.subscription_status === 'active';

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

          <div className="flex items-center gap-2">
            <Link
              href="/landlord"
              className="text-xs px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            >
              ← Back to dashboard
            </Link>
            <button
              onClick={handleLogOut}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
            >
              Log out
            </button>
          </div>
        </div>

        {/* Subscription status */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm space-y-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            Subscription
          </p>

          {isActive ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-50 font-medium">
                Status:{' '}
                <span className="text-emerald-300">
                  Active RentZentro landlord plan
                </span>
              </p>
              <p className="text-xs text-slate-400">
                Next billing date:{' '}
                <span className="text-slate-200">
                  {formatDate(landlord.subscription_current_period_end)}
                </span>
              </p>
              <p className="text-xs text-slate-500">
                Your subscription is active. You can access your full landlord
                dashboard, properties, tenants, and payments.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-400">
                You are currently not subscribed.
              </p>
              <p className="text-xs text-slate-500">
                Start your RentZentro landlord plan to unlock your dashboard,
                properties, tenants, rent tracking, and maintenance tools.
              </p>

              <button
                onClick={handleStartSubscription}
                disabled={startingCheckout}
                className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {startingCheckout ? 'Starting subscription…' : 'Subscribe & continue'}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
