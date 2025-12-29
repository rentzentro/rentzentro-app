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

  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
};

const isLandlordAccessAllowed = (row: LandlordAccessRow | null): boolean => {
  const status = (row?.subscription_status || '').toLowerCase();

  const isPaidPlanActive =
    status === 'active' ||
    status === 'trialing' ||
    status === 'active_cancel_at_period_end';

  const now = new Date();
  const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const trialEnd = parseSupabaseDate(row?.trial_end || null);

  const promoActive =
    !!row?.trial_active &&
    !!trialEnd &&
    !Number.isNaN(trialEnd.getTime()) &&
    trialEnd >= todayDateOnly;

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

  // Pages that MUST be reachable even when not subscribed / not logged in
  const alwaysAllow = useMemo(() => {
    return new Set<string>([
      '/landlord/login',
      '/landlord/signup',
      '/landlord/forgot',
      '/landlord/reset',
      '/landlord/invite',
      '/landlord/subscription',
      '/landlord/settings',
    ]);
  }, []);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setBlocked(false);
      setMsg(null);

      const path = pathname || '';
      const allowThisRoute = alwaysAllow.has(path);

      try {
        // 1) Auth check
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        // If auth check itself fails, do NOT bounce people around.
        if (authError) {
          console.error('Auth error in AccessGate:', authError);

          if (!allowThisRoute) {
            // Only redirect if we're not already on login
            if (path !== '/landlord/login') {
              router.replace('/landlord/login');
            }
          }

          setLoading(false);
          return;
        }

        const user = authData.user;
        const authUserId = user?.id || null;

        // Not logged in → allow login/signup pages, otherwise send to login
        if (!authUserId) {
          if (!allowThisRoute) {
            if (path !== '/landlord/login') {
              router.replace('/landlord/login');
            }
          }
          setLoading(false);
          return;
        }

        // Logged in + on login page → DO NOT auto-redirect here.
        // (Your login page can handle redirect after successful login)
        if (path === '/landlord/login' || path === '/landlord/signup') {
          setLoading(false);
          return;
        }

        // 2) Subscription check (only for protected routes)
        const { data: landlordRow, error: landlordErr } = await supabase
          .from('landlords')
          .select('subscription_status, trial_active, trial_end')
          .eq('user_id', authUserId)
          .maybeSingle();

        if (landlordErr) {
          console.error('Landlord access lookup error:', landlordErr);

          // Safer to block if we cannot verify, but never loop redirects.
          if (!allowThisRoute) {
            setBlocked(true);
            setMsg(
              'Your account status could not be verified right now. Please go to Account & billing to manage access.'
            );
            if (path !== '/landlord/subscription') {
              router.replace('/landlord/subscription');
            }
          }

          setLoading(false);
          return;
        }

        const ok = isLandlordAccessAllowed(
          (landlordRow as LandlordAccessRow | null) || null
        );

        if (!ok) {
          const status = ((landlordRow as any)?.subscription_status || '').toLowerCase();

          if (status === 'past_due' || status === 'unpaid') {
            setMsg(
              'Your subscription payment is past due. Please update billing to continue using RentZentro.'
            );
          } else {
            setMsg(
              'Your RentZentro subscription is not active. Please subscribe or start a trial to continue.'
            );
          }

          // If we are on allowed pages (settings/subscription), let them in to fix it.
          if (!allowThisRoute) {
            setBlocked(true);
            if (path !== '/landlord/subscription') {
              router.replace('/landlord/subscription');
            }
          } else {
            setBlocked(false);
          }

          setLoading(false);
          return;
        }

        // Access OK
        setBlocked(false);
        setMsg(null);
        setLoading(false);
      } catch (err: any) {
        console.error('AccessGate threw:', err);

        const pathNow = pathname || '';
        const allowNow = alwaysAllow.has(pathNow);

        if (!allowNow) {
          setBlocked(true);
          setMsg(
            err?.message ||
              'Something went wrong verifying your subscription. Please go to Account & billing to manage access.'
          );
          if (pathNow !== '/landlord/subscription') {
            router.replace('/landlord/subscription');
          }
        }

        setLoading(false);
      }
    };

    run();
  }, [pathname, alwaysAllow, router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <p className="text-sm text-slate-400">Checking your access…</p>
      </main>
    );
  }

  // Fallback UI in case redirect fails
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

          <div className="mt-5 space-y-2">
            <Link
              href="/landlord/subscription"
              className="inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Go to subscription
            </Link>
            <Link
              href="/landlord/settings"
              className="inline-flex w-full items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800"
            >
              Go to account & billing
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
