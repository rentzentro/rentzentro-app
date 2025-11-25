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
  user_id?: string | null;
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

const prettyStatus = (status: string | null) => {
  if (!status) return 'Not subscribed';
  if (status === 'active') return 'Active';
  if (status === 'trialing') return 'Trialing';
  if (status === 'past_due') return 'Past due';
  if (status === 'canceled') return 'Canceled';
  if (status === 'unpaid') return 'Unpaid';
  return status;
};

// ---------- Component ----------
export default function LandlordSubscriptionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Load / create landlord from auth user
  useEffect(() => {
    const billing = searchParams.get('billing');
    if (billing === 'success') {
      setInfo(
        'Your subscription was updated. If it still shows as not subscribed, try refreshing status.'
      );
    } else if (billing === 'cancelled') {
      setInfo('Subscription checkout was cancelled. You can try again anytime.');
    }

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user?.email) {
        router.push('/landlord/login');
        return;
      }

      const user = authData.user;
      const email = user.email!;

      // 1) Try by user_id
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

      // 2) Fallback: try by email (older rows)
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

      // 3) If still none, create landlord row
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

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.error ||
            `Unable to start subscription checkout (status ${res.status}).`
        );
      }

      if (!data.url) {
        throw new Error('Missing checkout URL from server.');
      }

      window.location.href = data.url;
    } catch (err: any) {
      console.error('Start subscription error:', err);
      setError(
        err?.message ||
          'Failed to begin subscription checkout. Please try again.'
      );
    } finally {
      setStartingCheckout(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!landlord) return;
    setCancelling(true);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landlordId: landlord.id }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || 'Unable to cancel subscription.');
      }

      setInfo(
        'Your subscription will be cancelled at the end of the current billing period. You will keep access until Stripe ends the subscription.'
      );
    } catch (err: any) {
      console.error('Cancel subscription error:', err);
      setError(
        err?.message || 'Failed to cancel subscription. Please try again.'
      );
    } finally {
      setCancelling(false);
    }
  };

  const handleRefreshStatus = () => {
    // Reload this page so it re-runs the Supabase load
    window.location.reload();
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
        {/* Header with top buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-50">
              Account & subscription
            </h1>
            <p className="text-xs text-slate-400">
              Manage your RentZentro landlord plan and billing.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
            >
              Back to homepage
            </button>
            <button
              type="button"
              onClick={() => router.push('/landlord')}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
            >
              Back to dashboard
            </button>
            <button
              type="button"
              onClick={handleLogOut}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
            >
              Log out
            </button>
          </div>
        </div>

        {/* Alerts */}
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

        {/* Plan card */}
        <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-900/30 via-slate-900 to-slate-950 px-4 py-4 space-y-3 shadow-sm">
          <p className="text-xs text-emerald-200/90 uppercase tracking-wide">
            RentZentro landlord plan
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <p className="text-2xl font-semibold text-slate-50">$29.95</p>
              <p className="text-xs text-slate-300">
                per month • cancel anytime
              </p>
            </div>
            <div className="text-[11px] text-slate-300">
              <p className="flex items-center gap-1">
                <span>✅</span> Unlimited properties and units
              </p>
              <p className="flex items-center gap-1">
                <span>✅</span> Secure Stripe-powered card payments
              </p>
              <p className="flex items-center gap-1">
                <span>✅</span> Tenant portal & maintenance tracking
              </p>
              <p className="flex items-center gap-1">
                <span>✅</span> Dashboard for overdue & upcoming rent
              </p>
            </div>
          </div>
        </section>

        {/* Status + actions */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs space-y-1">
              <p>
                <span className="text-slate-500">Account email:</span>{' '}
                <span className="text-slate-100">{landlord.email}</span>
              </p>

              <p>
                <span className="text-slate-500">Subscription status:</span>{' '}
                <span className={isActive ? 'text-emerald-300' : 'text-slate-100'}>
                  {prettyStatus(landlord.subscription_status)}
                </span>
              </p>

              <p>
                <span className="text-slate-500">Next billing date:</span>{' '}
                <span className="text-slate-100">
                  {landlord.subscription_current_period_end
                    ? formatDate(landlord.subscription_current_period_end)
                    : 'Subscription renewal is handled automatically through Stripe'}
                </span>
              </p>
            </div>

            <div className="flex flex-col sm:items-end gap-2 text-xs">
              {!isActive && (
                <button
                  type="button"
                  onClick={handleStartSubscription}
                  disabled={startingCheckout}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {startingCheckout
                    ? 'Starting subscription…'
                    : 'Subscribe for $29.95/mo'}
                </button>
              )}

              {isActive && (
                <button
                  type="button"
                  onClick={handleCancelSubscription}
                  disabled={cancelling}
                  className="rounded-full bg-red-500/90 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm hover:bg-red-400 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {cancelling ? 'Scheduling cancellation…' : 'Cancel subscription'}
                </button>
              )}

              <button
                type="button"
                onClick={handleRefreshStatus}
                className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800"
              >
                Refresh status
              </button>
            </div>
          </div>

          {isActive && (
            <div className="pt-2 border-t border-slate-800 mt-2 text-[11px]">
              <p className="text-slate-400">
                Your subscription is active and renews automatically each month
                through Stripe. If the next billing date is not shown here, you
                will still be billed on schedule.
              </p>
            </div>
          )}
        </section>

        {/* Support */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300 space-y-1">
          <p className="font-medium text-slate-100">Billing & support</p>
          <p>
            If you have questions about your subscription or billing, contact
            RentZentro support:
          </p>
          <p className="text-emerald-300">support@rentzentro.com</p>
        </section>
      </div>
    </main>
  );
}
