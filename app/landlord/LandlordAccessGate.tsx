// app/landlord/LandlordAccessGate.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../supabaseClient';

type LandlordAccessRow = {
  subscription_status: string | null;
  subscription_active: boolean | null;
  unit_count?: number | null;
};

const isLandlordAccessAllowed = (row: LandlordAccessRow | null): boolean => {
  const status = (row?.subscription_status || '').toLowerCase();

  const isPaidPlanActive =
    row?.subscription_active === true ||
    status === 'active' ||
    status === 'active_cancel_at_period_end';

  const unitCount = Number(row?.unit_count ?? 0);
  const isForeverFreeEligible = Number.isFinite(unitCount) && unitCount <= 1;

  return isPaidPlanActive || isForeverFreeEligible;
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
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError) {
          console.error('Auth error in AccessGate:', authError);

          if (!allowThisRoute && path !== '/landlord/login') {
            router.replace('/landlord/login');
          }

          setLoading(false);
          return;
        }

        const user = authData.user;
        const authUserId = user?.id || null;

        if (!authUserId) {
          if (!allowThisRoute && path !== '/landlord/login') {
            router.replace('/landlord/login');
          }
          setLoading(false);
          return;
        }

        if (path === '/landlord/login' || path === '/landlord/signup') {
          setLoading(false);
          return;
        }

        const { data: landlordRow, error: landlordErr } = await supabase
          .from('landlords')
          .select('subscription_status, subscription_active')
          .eq('user_id', authUserId)
          .maybeSingle();

        if (landlordErr) {
          console.error('Landlord access lookup error:', landlordErr);

          if (!allowThisRoute) {
            setBlocked(true);
            setMsg(
              'We could not verify your account right now. Please go to Account & billing to restore access.'
            );
            if (path !== '/landlord/subscription') {
              router.replace('/landlord/subscription');
            }
          }

          setLoading(false);
          return;
        }

        const { count: unitCount, error: unitCountErr } = await supabase
          .from('properties')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', authUserId);

        if (unitCountErr) {
          console.error('Unit count access lookup error:', unitCountErr);
        }

        const row = (landlordRow as LandlordAccessRow | null) || null;
        const ok = isLandlordAccessAllowed({
          subscription_status: row?.subscription_status || null,
          subscription_active: row?.subscription_active ?? null,
          unit_count: unitCount || 0,
        });

        if (!ok) {
          const status = ((landlordRow as any)?.subscription_status || '').toLowerCase();

          if (status === 'past_due' || status === 'unpaid') {
            setMsg(
              'Your payment didn’t go through. Update your billing to restore access.'
            );
          } else {
            setMsg(
              'Your account has more than one unit. Start a subscription to continue using RentZentro.'
            );
          }

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
            'Something went wrong verifying your account. Please go to billing to restore access.'
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
              'Your RentZentro access is no longer active. Please start your subscription to continue.'}
          </p>

          <div className="mt-5 space-y-2">
            <Link
              href="/landlord/subscription"
              className="inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Start subscription
            </Link>
            <Link
              href="/landlord/settings"
              className="inline-flex w-full items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800"
            >
              Account & billing
            </Link>
          </div>

          <p className="mt-4 text-[11px] text-amber-100/70">
            Once your subscription is active, refresh and you’ll have full access again.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}