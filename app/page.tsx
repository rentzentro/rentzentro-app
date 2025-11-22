'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabase } from './supabaseClient';

export default function HomePage() {
  const router = useRouter();
  const [landlordLoading, setLandlordLoading] = useState(false);

  const handleLandlordClick = async () => {
    setLandlordLoading(true);
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      // If a landlord is already logged in, go right to dashboard.
      // If not logged in, send them to the landlord signup flow.
      if (user) {
        router.push('/landlord');
      } else {
        router.push('/landlord/signup');
      }
    } catch (err) {
      console.error('Error resolving landlord flow:', err);
      router.push('/landlord/signup');
    } finally {
      setLandlordLoading(false);
    }
  };

  const handleTenantClick = () => {
    router.push('/tenant/login');
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-10">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/90 text-slate-950 text-sm font-bold">
              RZ
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-50">
                RentZentro
              </p>
              <p className="text-[11px] text-slate-400">
                Simple rent collection for small landlords
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-3 text-xs">
            <Link
              href="/landlord/login"
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-100 hover:bg-slate-800"
            >
              Landlord login
            </Link>
            <Link
              href="/tenant/login"
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-100 hover:bg-slate-800"
            >
              Tenant login
            </Link>
          </nav>
        </header>

        {/* Hero */}
        <section className="grid gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-start">
          {/* Left: copy + buttons */}
          <div className="space-y-5">
            <p className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
              Built for small landlords · No setup fees
            </p>

            <h1 className="text-3xl md:text-4xl font-semibold text-slate-50">
              Collect rent online without buying a full
              property-management empire.
            </h1>

            <p className="text-sm text-slate-300 max-w-xl">
              RentZentro gives you the parts you actually need—online rent
              payments, a clean tenant portal, maintenance tracking, and
              receipts—without the bloated software and $100+/month price tags.
            </p>

            {/* Primary CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleLandlordClick}
                disabled={landlordLoading}
                className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {landlordLoading ? 'Opening landlord setup…' : "I'm a landlord"}
              </button>

              <button
                type="button"
                onClick={handleTenantClick}
                className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-800"
              >
                I&apos;m a tenant
              </button>
            </div>

            <p className="text-[11px] text-slate-500 max-w-md">
              Landlords create a free account first. Subscription billing for
              the <span className="font-semibold text-slate-200">
                $29.95/mo
              </span>{' '}
              RentZentro Landlord Plan is started later from inside your secure
              dashboard—never on this public landing page.
            </p>

            {/* Feature blurbs */}
            <div className="grid gap-3 text-xs md:grid-cols-2 max-w-xl">
              <div className="space-y-1">
                <p className="font-semibold text-slate-100">
                  Online rent payments
                </p>
                <p className="text-slate-400">
                  Secure card payments via Stripe, plus the option to record
                  cash or check so your books stay clean.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-100">Tenant portal</p>
                <p className="text-slate-400">
                  Tenants log in to see their balance, payment history,
                  documents, and open maintenance requests.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-100">
                  Maintenance tracking
                </p>
                <p className="text-slate-400">
                  Tenants submit issues, you get an email, and both sides can
                  follow the status without messy text threads.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-100">
                  Receipts & history
                </p>
                <p className="text-slate-400">
                  Automatic receipts and a clear history per unit so tax time is
                  less painful.
                </p>
              </div>
            </div>
          </div>

          {/* Right: demo card */}
          <aside className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-emerald-500/10">
            <p className="text-[11px] text-slate-400 mb-2">
              Landlord demo · Portfolio overview
            </p>

            <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <p className="text-slate-400">This month&apos;s rent</p>
                  <p className="mt-1 text-lg font-semibold text-slate-50">
                    $4,250.00
                  </p>
                  <p className="text-[11px] text-slate-500">
                    3 units · 1 payment overdue
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/40 px-3 py-2 text-right">
                  <p className="text-[11px] text-emerald-200">92% collected</p>
                  <p className="text-[10px] text-emerald-300">
                    See what&apos;s due at a glance.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-2">
                  <p className="text-slate-400">Upcoming payments</p>
                  <p className="mt-1 text-slate-50 font-medium">3 tenants</p>
                  <p className="text-slate-500">Next due Jan 1</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-2">
                  <p className="text-slate-400">Open requests</p>
                  <p className="mt-1 text-slate-50 font-medium">2 issues</p>
                  <p className="text-slate-500">Plumbing · Heating</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-2">
                  <p className="text-slate-400">Cards & ACH*</p>
                  <p className="mt-1 text-slate-50 font-medium">$0 setup</p>
                  <p className="text-slate-500">Powered by Stripe</p>
                </div>
              </div>

              <p className="text-[10px] text-slate-500">
                *Card payments incur Stripe processing fees plus a small
                RentZentro platform fee, disclosed in your landlord dashboard.
              </p>

              <button
                type="button"
                onClick={handleLandlordClick}
                disabled={landlordLoading}
                className="mt-2 w-full rounded-full bg-slate-100/5 px-4 py-2 text-[11px] font-medium text-slate-100 border border-slate-700 hover:bg-slate-100/10 disabled:opacity-60"
              >
                {landlordLoading
                  ? 'Checking your landlord account…'
                  : 'Create or access your landlord account'}
              </button>
            </div>
          </aside>
        </section>

        {/* Pricing strip */}
        <section className="mt-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Simple pricing when you&apos;re ready
            </p>
            <p className="mt-1 text-sm font-medium text-slate-50">
              RentZentro Landlord Plan
            </p>
            <p className="mt-1 text-2xl font-semibold text-emerald-400">
              $29.95 <span className="text-sm text-slate-400">/ month</span>
            </p>
            <p className="mt-1 text-[11px] text-slate-400 max-w-xl">
              Subscription is started from inside your landlord dashboard after
              you create an account. No one can start a subscription from this
              public page. Existing landlords manage billing under{' '}
              <span className="font-semibold">
                Settings &rarr; Subscription
              </span>
              .
            </p>
          </div>

          <button
            type="button"
            onClick={handleLandlordClick}
            disabled={landlordLoading}
            className="self-start md:self-center rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {landlordLoading
              ? 'Opening landlord setup…'
              : 'Create landlord account'}
          </button>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-900 pt-4 mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
          <p>© {new Date().getFullYear()} RentZentro. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-emerald-300">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-emerald-300">
              Privacy Policy
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
