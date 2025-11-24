// app/landlord/complete-setup/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRouter } from 'next/navigation';

type LandlordRow = {
  id: number;
  email: string;
  user_id: string | null;
  stripe_connect_account_id: string | null;
  stripe_connect_onboarded: boolean;
};

export default function LandlordCompleteSetupPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startingStripe, setStartingStripe] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Load landlord on mount
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError || !authData.user) {
          router.push('/landlord/login');
          return;
        }

        const userId = authData.user.id;

        const { data: landlordRow, error: landlordError } = await supabase
          .from('landlords')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (landlordError) throw landlordError;
        if (!landlordRow) throw new Error('Landlord account not found.');

        const castLandlord = landlordRow as LandlordRow;
        setLandlord(castLandlord);

        // Already fully onboarded? → go straight to dashboard
        if (castLandlord.stripe_connect_onboarded === true) {
          router.push('/landlord');
          return;
        }

        // Otherwise, check Stripe status (e.g. after returning from Stripe)
        await checkStripeStatus(castLandlord.id);
      } catch (e: any) {
        console.error(e);
        setError(e.message || 'Unable to load landlord account.');
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const checkStripeStatus = async (landlordId: number) => {
    try {
      setCheckingStatus(true);
      setError(null);

      const res = await fetch('/landlord/stripe-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landlordId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to check Stripe status.');
      }

      if (data.onboarded) {
        // Onboarding complete → go to dashboard
        router.push('/landlord');
      }
    } catch (e: any) {
      console.error(e);
      // Not fatal – they can try again
      setError(
        e.message ||
          'Could not confirm payout setup yet. You can try again in a moment.'
      );
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleStartStripe = async () => {
    if (!landlord) return;

    setStartingStripe(true);
    setError(null);

    try {
      const res = await fetch('/landlord/stripe-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landlordId: landlord.id }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Failed to start Stripe onboarding.');
      }

      // Jump to Stripe onboarding
      window.location.href = data.url;
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Unable to start payout setup.');
    } finally {
      setStartingStripe(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading setup…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
        <h1 className="text-xl font-semibold text-slate-50">
          Complete your payout setup
        </h1>

        <p className="text-sm text-slate-400 leading-relaxed">
          To receive rent directly into your bank account, you must complete a
          secure Stripe payout setup. This step verifies your identity and
          connects your bank account. It only takes a few minutes.
        </p>

        {error && (
          <div className="rounded-md border border-red-500/60 bg-red-500/10 text-red-200 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleStartStripe}
          disabled={startingStripe}
          className="w-full rounded-full bg-emerald-500 text-slate-950 py-2 font-semibold text-sm hover:bg-emerald-400 disabled:opacity-60"
        >
          {startingStripe
            ? 'Starting secure Stripe setup…'
            : 'Connect payouts (Stripe)'}
        </button>

        {checkingStatus && (
          <p className="text-xs text-slate-400 text-center">
            Checking payout status…
          </p>
        )}

        <p className="text-xs text-slate-500 text-center leading-relaxed">
          Stripe is the same secure payment processor used by Amazon, Lyft, and
          millions of businesses. Your payout information is encrypted and never
          stored by RentZentro.
        </p>
      </div>
    </main>
  );
}
