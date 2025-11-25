'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../supabaseClient';

// Keep this type tiny and simple so TS is happy
type LandlordRow = {
  id: number;
  email: string;
  name: string | null;
};

export default function StripeConnectCompletePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        // Make sure user is logged in
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError || !authData.user?.email) {
          router.push('/landlord/login');
          return;
        }

        const user = authData.user;

        // Load landlord row by user_id first
        let { data: landlordRow, error: landlordError } = await supabase
          .from('landlords')
          .select('id, email, name')
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
            .select('id, email, name')
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

        // Try to mark Stripe payouts as onboarded
        const { error: updateError } = await supabase
          .from('landlords')
          .update({ stripe_connect_onboarded: true })
          .eq('id', landlordRow.id);

        if (updateError) {
          console.error(
            'Error updating stripe_connect_onboarded:',
            updateError
          );
          // Not fatal for the user; we still show the success screen
        }
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ||
            'There was a problem finishing your Stripe payouts setup.'
        );
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [router]);

  const handleGoToSettings = () => {
    router.push('/landlord/settings');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">
          Finishing your Stripe payouts setup…
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-slate-900/80 border border-slate-700 p-6 shadow-xl space-y-4">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={handleGoToSettings}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
          >
            Back to settings
          </button>
        </div>
      </main>
    );
  }

  const name = landlord?.name || 'your landlord account';

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-xl space-y-4">
        <p className="text-[11px] text-slate-500">
          <button
            type="button"
            onClick={handleGoToSettings}
            className="hover:text-emerald-300"
          >
            ← Back to settings
          </button>
        </p>

        <h1 className="text-lg font-semibold text-slate-50">
          Stripe payouts setup complete
        </h1>

        <p className="text-sm text-slate-300">
          Thanks for completing your Stripe payouts setup for{' '}
          <span className="font-semibold">{name}</span>.
        </p>
        <p className="text-sm text-slate-400">
          Your tenant rent payments will now be deposited directly to the bank
          account you added in Stripe, based on your Stripe payout schedule.
        </p>

        <div className="pt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={handleGoToSettings}
            className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Go to landlord settings
          </button>
          <Link
            href="/landlord"
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
