'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [startingCheckout, setStartingCheckout] = useState(false);

  // Load / create landlord record based on auth user
  useEffect(() => {
    const billing = searchParams.get('billing');
    if (billing === 'success') {
      setInfo('Your subscription was updated. If it still shows as not subscribed, try refreshing status.');
    } else if (billing === 'cancelled') {
      setInfo('Subscription checkout was cancelled. You can try again anytime.');
    }

    const load = async () => {
      setLoading(true);
      setError(null);

      // 1) Get auth user
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user?.email) {
        router.push('/landlord/login');
        return;
      }

      const user = authData.user;
      const email = user.email!;

      // 2) Try to find landlord by user_id
      let { data: landlordRow, error: landlordError } = await supabase
        .from('landlords')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (landlordError) {
        console.error('Error loading landlord by user_id:', landlordError);
        setError('Unable to load landlord account.');
        setLoading(false);
        return;
      }

      // 3) If still not found, try by email (for older rows)
      if (!landlordRow) {
        const byEmail = await supabase
          .from('landlords')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        if (byEmail.error) {
          console.error('Error loading landlord by email:', byEmail.error);
          setError('Unable to load landlord account.');
          setLoading(false);
          return;
        }

        landlordRow = byEmail.data as LandlordRow | null;
      }

      // 4) If still none, create landlord row
      if (!landlordRow) {
        const { data: inserted, error: insertError } = await supabase
          .from('landlords')
          .insert({
            email,
            user_id: user.id,
            name: null,
            stripe_customer_id: null,
            stripe_subscription_id: null,
            subscription_status: null,
            subscription_current_period_end: null,
          })
          .select('*')
          .single();

        if (insertError) {
          console.error('Error creating landlord record:', insertError);
          setError('Unable to create landlord account.');
          setLoading(false);
          return;
        }

        landlordRow = inserted as LandlordRow;
      }

      setLandlord(landlordRow);
      setLoading(false);
    };

    load();
  }, [router, searchParams]);

  const handleStartSubscription = async () => {
    if (!landlord) return;
    setStartingCheckout(true);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landlordId: landlord.id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.error || `Unable to start subscription checkout (status ${res.status}).`
        );
      }

      const data = await res.json();
      if (!data.url) throw new Error('Missing checkout URL from server.');

      window.location.href = data.url;
    } catch (err: any) {
      console.error('Start subscription error:', err);
      setError(
        err?.message || 'Failed to begin subscription checkout. Please try again.'
      );
    } finally {
      setStartingCheckout(false);
    }
  };

  const handleRefreshStatus = async () => {
    // Simple full reload so it re-runs the effect
    window.location.href = '/landlord/settings';
  };

  const handleLogOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/landlord/login';
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Loading account settings…</p>
      </main>
    );
  }

  if (!landlord) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-slate-900/80 border border-slate-700 p-6 shadow-xl space-y-4">
          <p className="text-sm text-red-400">
            {error || 'Unable to load landlord account.'}
          </p>
          <button
            onClick={handleLogOut}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
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
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="text-[11px] text-slate-500 hover:text-emerald-300"
            >
              ← Back to homepage
            </button>
            <h1 className="mt-1 text-xl font-semibold text-slate-50">
              Account & subscription
            </h1>
            <p className="text-xs text-slate-400">
              Manage your RentZentro landlord subscription and account status.
            </p>
          </div>
          <button
            onClick={handleLogOut}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
          >
            Log out
          </button>
        </div>

        {/* Messages */}
        {(info || error) && (
          <div
            className={`rounded-xl border px-4 py-2 text-sm ${
              error
                ? 'border-red-500/60 bg-red-500/10 text-red-200'
                : 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
            }`}
          >
            {error || info}
          </div>
        )}

        {/* Plan summary */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-2">
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            RentZentro landlord plan
          </p>
          <p className="text-sm font-semibold text-slate-50">
            $29.95 / month • Cancel anytime
          </p>
          <ul className="mt-2 space-y-1 text-xs text-slate-300">
            <li>• Unlimited properties and units</li>
            <li>• Secure card payments powered by Stripe</li>
            <li>• Tenant portal, maintenance requests, and payment history</li>
            <li>• Dashboard for overdue & upcoming rent</li>
          </ul>
        </section>

        {/* Current status */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300 space-y-2">
          <p>
            <span className="text-slate-500">Account email:</span>{' '}
            <span className="text-slate-100">{landlord.email}</span>
          </p>
          <p>
            <span className="text-slate-500">Subscription status:</span>{' '}
            <span className={isActive ? 'text-emerald-300' : 'text-slate-100'}>
              {landlord.subscription_status || 'Not subscribed'}
            </span>
          </p>
          <p>
            <span className="text-slate-500">Next billing date:</span>{' '}
            <span className="text-slate-100">
              {formatDate(landlord.subscription_current_period_end)}
            </span>
          </p>
        </section>

        {/* Actions */}
        <section className="space-y-3">
          {!isActive && (
            <button
              type="button"
              onClick={handleStartSubscription}
              disabled={startingCheckout}
              className="w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {startingCheckout ? 'Starting subscription…' : 'Subscribe for $29.95/mo'}
            </button>
          )}

          <button
            type="button"
            onClick={handleRefreshStatus}
            className="w-full rounded-full border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 hover:bg-slate-800"
          >
            Refresh subscription status
          </button>

          {isActive && (
            <button
              type="button"
              onClick={() => router.push('/landlord')}
              className="w-full rounded-full border border-emerald-500/60 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20"
            >
              Go to landlord dashboard
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
