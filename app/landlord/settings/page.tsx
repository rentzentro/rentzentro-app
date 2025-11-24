'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

type LandlordRow = {
  id: number;
  name: string | null;
  email: string;
  user_id: string | null;
  stripe_account_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  subscription_current_period_end?: string | null;
};

export default function LandlordSettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [canceling, setCanceling] = useState(false);

  // ---------- Load landlord + auto-link old records ----------

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;
        if (!user) {
          throw new Error('You must be logged in to view landlord settings.');
        }

        // 1) Try landlord by user_id (new accounts)
        const {
          data: byUser,
          error: byUserError,
        } = await supabase
          .from('landlords')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (byUserError) throw byUserError;

        let row = byUser as LandlordRow | null;

        // 2) Fallback: old landlords created before user_id existed
        if (!row && user.email) {
          const {
            data: byEmail,
            error: byEmailError,
          } = await supabase
            .from('landlords')
            .select('*')
            .eq('email', user.email)
            .maybeSingle();

          if (byEmailError) throw byEmailError;

          if (byEmail) {
            let linked = byEmail as LandlordRow;

            // If this row has no user_id yet, link it to the current user
            if (!linked.user_id) {
              const {
                data: updated,
                error: updateError,
              } = await supabase
                .from('landlords')
                .update({ user_id: user.id })
                .eq('id', linked.id)
                .select('*')
                .single();

              if (updateError) throw updateError;
              if (updated) {
                linked = updated as LandlordRow;
              }
            }

            row = linked;
          }
        }

        if (!row) {
          setLandlord(null);
          setError(
            'We could not find a landlord record linked to this account. If you already have a subscription, please contact support so we can link it.'
          );
          return;
        }

        setLandlord(row);
      } catch (err: any) {
        console.error('Load landlord settings error:', err);
        setError(
          err?.message ||
            'Something went wrong while loading your landlord settings.'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // ---------- Derived subscription info ----------

  const status = landlord?.subscription_status || 'none';
  const isActive = status === 'active' || status === 'trialing';
  const isCanceled =
    status === 'canceled' ||
    status === 'unpaid' ||
    status === 'incomplete_expired';

  const periodEnd = landlord?.subscription_current_period_end
    ? new Date(landlord.subscription_current_period_end)
    : null;

  const formattedPeriodEnd =
    periodEnd && !Number.isNaN(periodEnd.getTime())
      ? periodEnd.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null;

  // ---------- Actions ----------

  const handleGoToDashboard = () => {
    router.push('/landlord/dashboard');
  };

  const handleManageSubscription = async () => {
    if (!landlord) return;
    setManaging(true);
    setError(null);

    try {
      const res = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'manage', // your API route can treat this as "open customer portal"
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.error ||
            `Failed to open subscription management (status ${res.status}).`
        );
      }

      const data = await res.json();
      if (!data?.url) {
        throw new Error('Missing redirect URL from subscription endpoint.');
      }

      window.location.href = data.url;
    } catch (err: any) {
      console.error('Manage subscription error:', err);
      setError(
        err?.message ||
          'Something went wrong while opening your subscription settings.'
      );
    } finally {
      setManaging(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!landlord) return;
    setCanceling(true);
    setError(null);

    try {
      const res = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'cancel', // your API route can treat this as "cancel at period end"
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.error ||
            `Failed to cancel subscription (status ${res.status}).`
        );
      }

      // Optional: reload settings after cancel
      window.location.reload();
    } catch (err: any) {
      console.error('Cancel subscription error:', err);
      setError(
        err?.message ||
          'Something went wrong while requesting subscription cancellation.'
      );
    } finally {
      setCanceling(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/landlord/login');
  };

  // ---------- Render ----------

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading your settings…</p>
      </main>
    );
  }

  if (!landlord) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4">
          <h1 className="text-lg font-semibold text-slate-50">
            Landlord settings
          </h1>
          <p className="text-sm text-red-300">
            {error ||
              'We could not find a landlord record for this account.'}
          </p>
          <button
            onClick={handleLogout}
            className="mt-2 inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800"
          >
            Back to login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">
              Subscription & settings
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Manage your RentZentro landlord subscription.
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="font-medium text-slate-100">
              {landlord.name || 'Landlord account'}
            </p>
            <p className="text-slate-400">{landlord.email}</p>
            <button
              onClick={handleLogout}
              className="mt-2 inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] text-slate-100 hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-500/70 bg-red-500/10 px-4 py-2 text-sm text-red-100">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Subscription
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-50">
                RentZentro Landlord Plan – $29.95/month
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Status:{' '}
                <span
                  className={
                    isActive
                      ? 'text-emerald-300 font-medium'
                      : isCanceled
                      ? 'text-amber-300 font-medium'
                      : 'text-slate-200 font-medium'
                  }
                >
                  {status || 'none'}
                </span>
                {formattedPeriodEnd && (
                  <span className="text-slate-400">
                    {' '}
                    · Renews / ends on {formattedPeriodEnd}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {isActive ? (
              <>
                <button
                  type="button"
                  onClick={handleGoToDashboard}
                  className="flex-1 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
                >
                  Go to landlord dashboard
                </button>
                <button
                  type="button"
                  onClick={handleManageSubscription}
                  disabled={managing}
                  className="flex-1 rounded-full border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 hover:bg-slate-800 disabled:opacity-60"
                >
                  {managing ? 'Opening Stripe…' : 'Manage billing in Stripe'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelSubscription}
                  disabled={canceling}
                  className="flex-1 rounded-full border border-red-500/70 bg-red-500/10 px-4 py-2.5 text-sm text-red-100 hover:bg-red-500/20 disabled:opacity-60"
                >
                  {canceling ? 'Requesting cancel…' : 'Cancel subscription'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleManageSubscription}
                  disabled={managing}
                  className="flex-1 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {managing
                    ? 'Opening Stripe…'
                    : 'Start your $29.95/mo subscription'}
                </button>
                <button
                  type="button"
                  onClick={handleGoToDashboard}
                  className="flex-1 rounded-full border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 hover:bg-slate-800"
                >
                  View dashboard (limited)
                </button>
              </>
            )}
          </div>

          <p className="mt-1 text-[11px] text-slate-500">
            Payments are processed securely by Stripe. You can cancel anytime in
            Stripe or from this page.
          </p>
        </section>
      </div>
    </main>
  );
}
