'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-10">
        {/* Top nav / logo */}
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-400/60">
              <span className="text-xs font-semibold text-emerald-300">RZ</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-slate-50">
                RentZentro
              </span>
              <span className="text-[11px] text-slate-400">
                Rent payments. Centralized.
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-4 text-xs text-slate-400">
            <span className="hidden sm:inline">Stripe powered</span>
            <span className="hidden sm:inline">Landlord portals</span>
            <span className="hidden sm:inline">Tenant payments</span>
          </nav>
        </header>

        {/* Hero */}
        <section className="mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-[11px] uppercase tracking-wide text-emerald-200">
            <span>Stripe powered</span>
            <span className="text-slate-500">•</span>
            <span>Landlord portals</span>
            <span className="text-slate-500">•</span>
            <span>Tenant payments</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight text-slate-50">
            <span className="text-emerald-400">Rent collection</span>{' '}
            without the chaos.
          </h1>

          <p className="mt-4 max-w-2xl text-sm text-slate-300">
            A modern way for landlords to track units, tenants, and rent — and
            accept secure online payments through Stripe. Simple enough for
            single-unit owners. Powerful enough for full portfolios.
          </p>

          {/* Launching-soon buttons (disabled) */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              disabled
              className="w-full rounded-full bg-emerald-500/60 px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm shadow-emerald-500/40 transition disabled:cursor-not-allowed disabled:opacity-80 sm:w-auto"
            >
              I’m a landlord (coming soon)
            </button>

            <button
              type="button"
              disabled
              className="w-full rounded-full border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-300 transition disabled:cursor-not-allowed disabled:opacity-80 sm:w-auto"
            >
              I’m a tenant (coming soon)
            </button>
          </div>

          <p className="mt-3 text-[11px] text-slate-500">
            Portals are currently in private testing. Public sign-ups will open
            soon.
          </p>

          <p className="mt-1 text-[11px] text-slate-500">
            No monthly subscription. RentZentro charges a{' '}
            <span className="font-semibold text-slate-300">
              2.5% platform fee
            </span>{' '}
            per successful card payment, plus Stripe fees.
          </p>
        </section>

        {/* Why landlords trust section */}
        <section className="mb-10 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-100 mb-2">
            Why landlords trust RentZentro
          </h2>
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div className="flex gap-2">
              <div className="mt-1 h-5 w-5 flex-shrink-0 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xs">
                ✓
              </div>
              <div>
                <p className="font-medium text-slate-100">
                  Organized dashboards
                </p>
                <p className="text-xs text-slate-400">
                  See units, tenants, upcoming and overdue rent at a glance.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="mt-1 h-5 w-5 flex-shrink-0 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xs">
                ✓
              </div>
              <div>
                <p className="font-medium text-slate-100">
                  Secure online payments
                </p>
                <p className="text-xs text-slate-400">
                  Tenants pay through Stripe Checkout. Funds flow to your Stripe
                  account.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="mt-1 h-5 w-5 flex-shrink-0 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xs">
                ✓
              </div>
              <div>
                <p className="font-medium text-slate-100">
                  History that matches reality
                </p>
                <p className="text-xs text-slate-400">
                  Track payments, rent status, and tenant details in one place.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* What you manage section */}
        <section className="mb-12">
          <h2 className="mb-3 text-sm font-semibold text-slate-100">
            What you manage in RentZentro
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Properties & tenants
              </p>
              <p className="mt-2 text-sm font-medium text-slate-100">
                Keep units and tenant records in sync.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Store rent amounts, lease dates, contact details, and unit
                assignments so you always know who lives where and what they
                owe.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Rent & payments
              </p>
              <p className="mt-2 text-sm font-medium text-slate-100">
                See what&apos;s paid, overdue, or coming up.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Use Stripe-powered card payments or record manual payments so
                your ledger matches reality.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Documents (early access)
              </p>
              <p className="mt-2 text-sm font-medium text-slate-100">
                Attach leases and key files to each property.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Upload signed leases, addenda, and other documents so they&apos;re
                always one click away.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Coming next
              </p>
              <p className="mt-2 text-sm font-medium text-slate-100">
                Maintenance tracking & reminders.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Future updates will focus on maintenance requests, reminders,
                and more automation for busy landlords.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-800 pt-4 text-[11px] text-slate-500 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} RentZentro. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-slate-300">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-slate-300">
              Privacy Policy
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
