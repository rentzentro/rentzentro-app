'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../supabaseClient';

type Landlord = {
  id: number;
  name?: string | null;
  email?: string | null;
  stripe_account_id?: string | null;
};

const DEFAULT_LANDLORD_ID = 1;

export default function LandlordPayoutsPage() {
  const [landlord, setLandlord] = useState<Landlord | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLandlord = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('landlords')
        .select('id, name, email, stripe_account_id')
        .eq('id', DEFAULT_LANDLORD_ID)
        .single();

      if (error) {
        console.error('Error loading landlord:', error);
        setError('Unable to load payout settings.');
      } else {
        setLandlord(data);
      }

      setLoading(false);
    };

    loadLandlord();
  }, []);

  const handleConnectStripe = async () => {
    setConnecting(true);
    setError(null);

    try {
      const res = await fetch('/api/stripe/connect-link', {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to start Stripe onboarding.');
      }

      const data = await res.json();
      if (data.url) {
        // Redirect landlord to Stripe onboarding
        window.location.href = data.url as string;
      } else {
        throw new Error('No onboarding URL returned from server.');
      }
    } catch (err: any) {
      console.error('Error starting Stripe onboarding:', err);
      setError(err.message || 'Something went wrong starting onboarding.');
      setConnecting(false);
    }
  };

  const statusText = () => {
    if (!landlord) return 'Unknown';
    if (landlord.stripe_account_id) return 'Connected to Stripe';
    return 'Not yet connected';
  };

  const statusColor = () => {
    if (!landlord) return 'text-slate-400';
    if (landlord.stripe_account_id) return 'text-emerald-300';
    return 'text-amber-300';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-10">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6 gap-3">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-[0.18em]">
              LANDLORD PORTAL
            </p>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-50">
              Payouts via Stripe
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Connect your Stripe account so rent payments can be paid out
              directly to your bank. Stripe handles bank details, identity
              checks, and payouts.
            </p>
          </div>

          <Link
            href="/landlord"
            className="text-xs px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
          >
            ← Back to dashboard
          </Link>
        </div>

        {/* Main card */}
        <div className="rounded-2xl bg-slate-950 border border-slate-800 p-5 md:p-6">
          {loading ? (
            <p className="text-sm text-slate-400">Loading payout settings…</p>
          ) : error ? (
            <p className="text-sm text-rose-300">{error}</p>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-sm text-slate-300">
                  Status:{' '}
                  <span className={`font-semibold ${statusColor()}`}>
                    {statusText()}
                  </span>
                </p>
                {landlord?.email && (
                  <p className="text-xs text-slate-500 mt-1">
                    Landlord account email:{' '}
                    <span className="text-slate-300">{landlord.email}</span>
                  </p>
                )}
                {landlord?.stripe_account_id && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Stripe account ID:{' '}
                    <span className="text-slate-400">
                      {landlord.stripe_account_id}
                    </span>
                  </p>
                )}
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleConnectStripe}
                  disabled={connecting}
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {connecting ? 'Opening Stripe…' : 'Connect payouts with Stripe'}
                </button>
                <p className="mt-2 text-[11px] text-slate-500 max-w-md">
                  You&apos;ll be redirected to Stripe to enter bank details and
                  verify your identity. Stripe will then handle payouts of rent
                  directly to your bank account. RentZentro never sees or stores
                  your bank information.
                </p>
              </div>
            </>
          )}
        </div>

        <p className="mt-4 text-[11px] text-slate-500">
          Note: This page currently assumes a single landlord record with ID 1.
          As you add multiple landlords, this will be extended to use each
          landlord&apos;s own Stripe account.
        </p>
      </div>
    </div>
  );
}
