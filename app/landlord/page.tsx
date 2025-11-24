'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useRouter } from 'next/navigation';

export default function LandlordDashboardGate() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data, error: authError } = await supabase.auth.getUser();
      if (authError || !data?.user?.email) {
        router.push('/landlord/login');
        return;
      }

      const email = data.user.email;

      // Load landlord row
      const { data: landlord, error: landlordErr } = await supabase
        .from('landlords')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (landlordErr) {
        setError('Unable to load landlord account.');
        setLoading(false);
        return;
      }

      // No landlord row yet → onboarding
      if (!landlord) {
        router.push('/landlord/onboarding');
        return;
      }

      // Not subscribed yet → subscription screen
      if (!landlord.subscription_status || landlord.subscription_status !== 'active') {
        router.push('/landlord/subscription');
        return;
      }

      // All good → dashboard
      router.push('/landlord/dashboard');
    }

    load();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">
      {loading ? 'Loading landlord account…' : error}
    </main>
  );
}
