// app/landlord/LandlordAccessGate.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../supabaseClient';

type LandlordAccessRow = {
  subscription_status: string | null;
  trial_active: boolean | null;
  trial_end: string | null;
};

const parseSupabaseDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;

  // Pure date (YYYY-MM-DD) → avoid timezone shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  // Normalize to date-only to keep comparisons consistent
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const isLandlordAccessAllowed = (row: LandlordAccessRow | null): boolean => {
  const status = (row?.subscription_status || '').toLowerCase();

  const isPaidPlanActive =
    status === 'active' ||
    status === 'trialing' ||
    status === 'active_cancel_at_period_end';

  const now = new Date();
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const trialEnd = parseSupabaseDate(row?.trial_end || null);

  const promoActive =
    !!row?.trial_active &&
    !!trialEnd &&
    !Number.isNaN(trialEnd.getTime()) &&
    trialEnd >= todayOnly;

  return isPaidPlanActive || promoActive;
};

export default function LandlordAccessGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // These pages must remain reachable so an unpaid landlord can fix billing.
  const allowedWhenBlocked = useMemo(() => {
    return new Set<string>(['/landlord/settings', '/landlord/subscription']);
  }, []);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setBlocked(false);
      setMsg(null);

      try {
        const allowThisRoute = allowedWhenBlocked.has(pathname || '');

        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError) throw authError;

        const user = authData.user;
        const authUserId = user?.id;
        const authEmail = user?.email || null;

        if (!authUserId) {
          router.push('/landlord/login');
          return;
        }

        // Try to load landlord access info by user_id first
        let landlordRow: LandlordAccessRow | null = null;

        const byUserId = await supabase
          .from('landlords')
          .select('subscription_status, trial_active, trial_end')
          .eq('user_id', authUserId)
          .maybeSingle();

        if (byUserId.error) {
          console.error('Landlord access lookup (user_id) error:', byUserId.error);
          if (!allowThisRoute) {
            setBlocked(true);
            setMsg(
              'Your account status could not be verified right now. Please go to Subscription to manage billing.'
            );
            router.push('/landlord/subscription');
          }
          return;
        }

        landlordRow = (byUserId.data as LandlordAccessRow | null) || null;

        // Fallback: older rows might only match by email
        if (!landlordRow && authEmail) {
          const byEmail = await supabase
            .from('landlords')
            .select('subscription_status, trial_active, trial_end')
            .eq('email', authEmail)
            .maybeSingle();

          if (byEmail.error) {
            console.error('Landlord access lookup (email) error:', byEmail.error);
            if (!allowThisRoute) {
              setBlocked(true);
              setMsg(
                'Your account status could not be verified right now. Please go to Subscription to manage billing.'
              );
              router.push('/landlord/subscription');
            }
            return;
          }

          landlordRow = (byEmail.data as LandlordAccessRow | null) || null;
        }

        const ok = isLandlordAccessAllowed(landlordRow);

        if (!ok) {
          const status = (landlordRow?.subscription_status || '').toLowerCase();

          if (status === 'past_due' || status === 'unpaid') {
            setMsg(
              'Your subscription payment is past due. Please update billing to continue using RentZentro.'
            );
          } else {
            setMsg(
              'Your RentZentro subscription is not active. Please subscribe to continue.'
            );
          }

          if (!allowThisRoute) {
            setBlocked(true);
            router.push('/landlord/subscription');
            return;
          }

          // If they ARE on settings/subscription, let them view it even though they’re blocked.
          setBlocked(false);
          return;
        }

        // Access ok
        setBlocked(false);
        setMsg(null);
      } catch (err: any) {
        console.error(err);

        const allowThisRoute = allowedWhenBlocked.has(pathname || '');
        if (!allowThisRoute) {
          setBlocked(true);
          setMsg(
            err?.message ||
              'Something went wrong verifying your subscription. Please go to Subscription to manage billing.'
          );
          router.push('/landlord/subscription');
        }
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [pathname, allowedWhenBlocked, router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <p className="text-sm text-slate-400">Checking your subscription…</p>
      </main>
    );
  }

  // Fallback UI if redirect fails for some reason
  if (blocked) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-2xl border border-amber-500/40 bg-amber-950/30 p-6 shadow-xl">
          <p className="text-xs uppercase tracking-wide text-amber-200/80">
            Access restricted
          </p>
          <h1 className="mt-1 text-lg font-semibold text-slate-50">
            Subscription required
          </h1>
          <p className="mt-2 text-sm text-amber-100/90">
            {msg ||
              'Your RentZentro subscription is not active. Please update billing to continue.'}
          </p>

          <div className="mt-5">
            <Link
              href="/landlord/subscription"
              className="inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Go to subscription
            </Link>
          </div>

          <p className="mt-4 text-[11px] text-amber-100/70">
            Once your subscription is active, refresh the page and you’ll have
            access again.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
