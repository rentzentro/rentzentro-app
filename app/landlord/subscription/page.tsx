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
  // Promo / trial fields
  trial_active?: boolean | null;
  trial_end?: string | null;
};

// ---------- Helpers ----------
const formatDate = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const prettyStatus = (status: string | null) => {
  if (!status) return 'Not subscribed';
  if (status === 'active') return 'Active';
  if (status === 'active_cancel_at_period_end')
    return 'Active (scheduled to cancel)';
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

  // Extra: live cancellation date from Stripe (fallback if DB has null)
  const [stripeCancelDate, setStripeCancelDate] = useState<string | null>(null);
  const [loadingStripeDate, setLoadingStripeDate] = useState(false);

  // Account deletion request UI
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [requestingDeletion, setRequestingDeletion] = useState(false);

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

  // When we have a landlord, if they are scheduled to cancel and DB has no date,
  // query Stripe directly to get the current_period_end.
  useEffect(() => {
    const fetchStripeCancelDate = async () => {
      if (!landlord) return;

      const isScheduledToCancel =
        landlord.subscription_status === 'active_cancel_at_period_end';

      const dbHasDate = !!landlord.subscription_current_period_end;

      if (!isScheduledToCancel || dbHasDate) return;

      setLoadingStripeDate(true);
      try {
        const res = await fetch('/api/subscription/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ landlordId: landlord.id }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok && data?.current_period_end) {
          const formatted = formatDate(data.current_period_end);
          if (formatted) setStripeCancelDate(formatted);
        }
      } catch (err) {
        console.error('Error fetching Stripe subscription status:', err);
      } finally {
        setLoadingStripeDate(false);
      }
    };

    fetchStripeCancelDate();
  }, [landlord]);

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
        'Your subscription will stay active until the end of the current billing cycle, then cancel automatically.'
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
    window.location.reload();
  };

  const handleLogOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/landlord/login';
  };

  const handleRequestAccountDeletion = async () => {
    if (!landlord) return;
    setRequestingDeletion(true);
    setError(null);
    setInfo(null);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const authedUserId = authData?.user?.id || null;

      const res = await fetch('/api/account/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          landlordId: landlord.id,
          landlordEmail: landlord.email,
          landlordName: landlord.name,
          userId: authedUserId,
          reason: 'User requested account deletion from Account & subscription page.',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to submit deletion request.');
      }

      setShowDeleteModal(false);
      setDeleteConfirmText('');
      setInfo(
        'Your account deletion request was received. RentZentro support will follow up shortly.'
      );
    } catch (err: any) {
      console.error('Delete request error:', err);
      setError(
        err?.message ||
          'Failed to submit account deletion request. Please try again.'
      );
    } finally {
      setRequestingDeletion(false);
    }
  };

  // ---------- Derived values (NO hooks below this line) ----------
  const isScheduledToCancel =
    landlord?.subscription_status === 'active_cancel_at_period_end';

  const isActive =
    landlord?.subscription_status === 'active' || !!isScheduledToCancel;

  const dbDateLabel = formatDate(landlord?.subscription_current_period_end || null);
  const effectiveDateLabel = stripeCancelDate || dbDateLabel;

  // Promo / free-access logic
  const now = new Date();
  const trialEndDate = landlord?.trial_end ? new Date(landlord.trial_end) : null;

  const isOnPromoTrial =
    !!landlord?.trial_active &&
    !!trialEndDate &&
    !Number.isNaN(trialEndDate.getTime()) &&
    trialEndDate >= now;

  const trialEndLabel = trialEndDate
    ? formatDate(landlord?.trial_end || null)
    : null;

  const showPromoBanner =
    !!landlord && isOnPromoTrial && !isActive && !landlord.subscription_status;

  const showPromoAsStatusNote = showPromoBanner;

  // ---------- UI ----------
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

        {/* Promo banner for free period */}
        {showPromoBanner && (
          <div className="rounded-2xl border border-emerald-500/50 bg-emerald-950/40 px-4 py-3 text-xs text-emerald-100 space-y-1">
            <p className="font-semibold text-emerald-200">
              You&apos;re on free RentZentro access.
            </p>
            <p>
              You can use RentZentro without a paid subscription until{' '}
              <span className="font-semibold text-emerald-200">
                {trialEndLabel || 'the end of your promo period'}
              </span>
              . During this time, you won&apos;t be billed. When you&apos;re
              ready to continue after the promo, start your $29.95/mo
              subscription from this page.
            </p>
          </div>
        )}

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
              {showPromoBanner && trialEndLabel && (
                <p className="mt-1 text-[11px] text-emerald-200">
                  You&apos;re not being billed yet. Promo access lasts until{' '}
                  {trialEndLabel}.
                </p>
              )}
            </div>
            <div className="text-[11px] text-slate-300">
              <p className="flex items-center gap-1">
                <span>✅</span> Unlimited properties and units
              </p>
              <p className="flex items-center gap-1">
                <span>✅</span> Secure Stripe-powered card & ACH payments
              </p>
              <p className="flex items-center gap-1">
                <span>✅</span> Tenant portal & maintenance tracking
              </p>
              <p className="flex items-center gap-1">
                <span>✅</span> Listings (public rental pages + inquiries)
              </p>
              <p className="flex items-center gap-1">
                <span>✅</span> Team members & managers access
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
                  {showPromoAsStatusNote && !landlord.subscription_status && (
                    <span className="ml-1 text-emerald-300">(on free access)</span>
                  )}
                </span>
              </p>

              <p>
                <span className="text-slate-500">
                  {isOnPromoTrial && !isActive && !landlord.subscription_status
                    ? 'Promo period ends:'
                    : isScheduledToCancel
                    ? 'Cancellation date:'
                    : 'Next billing date:'}
                </span>{' '}
                <span className="text-slate-100">
                  {isOnPromoTrial && !isActive && !landlord.subscription_status ? (
                    trialEndLabel || 'Not available'
                  ) : effectiveDateLabel ? (
                    isScheduledToCancel ? (
                      `Scheduled to cancel on ${effectiveDateLabel}`
                    ) : (
                      effectiveDateLabel
                    )
                  ) : loadingStripeDate ? (
                    'Loading cancellation date…'
                  ) : isActive ? (
                    'Not available — renewal is handled automatically through Stripe'
                  ) : (
                    'No paid subscription started yet'
                  )}
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
                unless you cancel. If you&apos;ve scheduled cancellation,
                you&apos;ll keep full access until the cancellation date shown
                above.
              </p>
            </div>
          )}

          {showPromoBanner && (
            <div className="pt-2 border-t border-slate-800 mt-2 text-[11px] text-slate-400">
              <p>
                During your free access period, you can still set up payouts in
                settings and use RentZentro with real tenants. You&apos;ll only
                be billed if you choose to start the $29.95/mo subscription.
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

        {/* Account deletion */}
        <section className="rounded-2xl border border-red-500/30 bg-slate-900/60 p-4 text-xs text-slate-300 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="font-medium text-slate-100">Delete account</p>
              <p className="text-[11px] text-slate-400">
                Request permanent deletion of your RentZentro account. We will
                remove your personal data and revoke access. Payment/transaction
                records may be retained for legal/accounting purposes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="shrink-0 rounded-full bg-red-500/90 px-4 py-2 text-xs font-semibold text-slate-950 shadow-sm hover:bg-red-400"
            >
              Request deletion
            </button>
          </div>
        </section>

        {/* Delete confirmation modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-black/70"
              onClick={() =>
                !requestingDeletion ? setShowDeleteModal(false) : null
              }
            />
            <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl">
              <p className="text-sm font-semibold text-slate-50">
                Confirm account deletion request
              </p>
              <p className="mt-2 text-[12px] text-slate-300">
                This will submit a deletion request to RentZentro support. Your
                access will be removed after the request is processed.
              </p>

              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-[11px] text-slate-300 space-y-1">
                <p className="text-slate-200 font-medium">What gets deleted</p>
                <p>• Your account profile and access</p>
                <p>• Personal information (name/email) where allowed</p>
                <p>• Stored files/documents where applicable</p>
                <p className="pt-1 text-slate-400">
                  Note: Payment/transaction records may be retained for
                  legal/accounting purposes.
                </p>
              </div>

              <div className="mt-3 space-y-2">
                <label className="block text-[11px] text-slate-400">
                  Type{' '}
                  <span className="font-semibold text-slate-200">DELETE</span>{' '}
                  to confirm:
                </label>
                <input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 outline-none focus:border-emerald-500/60"
                  disabled={requestingDeletion}
                />
              </div>

              <div className="mt-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={requestingDeletion}
                  className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRequestAccountDeletion}
                  disabled={
                    requestingDeletion ||
                    deleteConfirmText.trim().toUpperCase() !== 'DELETE'
                  }
                  className="rounded-md bg-red-500/90 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-red-400 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {requestingDeletion ? 'Submitting…' : 'Submit deletion request'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
