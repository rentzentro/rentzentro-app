'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      {/* Top bar */}
      <header className="w-full border-b border-slate-900/80 bg-slate-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Logo + brand */}
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-sm shadow-emerald-500/40">
              <span className="text-xs font-bold text-slate-950 tracking-[0.16em]">
                RZ
              </span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">RentZentro</p>
              <p className="text-[11px] text-slate-400">
                Simple rent collection, shared clarity.
              </p>
            </div>
          </div>

          {/* Tiny beta tag */}
          <div className="hidden text-[11px] text-emerald-300/80 sm:block">
            Beta preview · Payments coming soon
          </div>
        </div>
      </header>

      {/* Hero section */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 lg:flex-row lg:items-center">
          {/* Left column – text + buttons */}
          <section className="flex-1 space-y-6">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-400">
                Rent collection · Made easier
              </p>

              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
                Collect rent online and see everything in one place.
              </h1>

              <p className="text-sm text-slate-400 sm:text-[15px] max-w-xl">
                RentZentro gives landlords a clean dashboard to manage properties,
                tenants, and rent tracking — and gives tenants a simple portal to see
                what&apos;s due, when it&apos;s due, and what they&apos;ve paid.
                Stripe-powered payments will plug in next.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex flex-wrap gap-3">
              {/* LANDLORD */}
              <Link
                href="/landlord/login"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-2 text-sm font-medium text-slate-950 shadow-sm shadow-emerald-500/40 hover:bg-emerald-400 transition"
              >
                I&apos;m a landlord
                <span className="text-xs">→</span>
              </Link>

              {/* TENANT */}
              <Link
                href="/tenant/login"
                className="inline-flex items-center justify-center rounded-full border border-slate-700 px-6 py-2 text-sm text-slate-100 hover:bg-slate-900 transition"
              >
                I&apos;m a tenant
              </Link>
            </div>

            {/* Social proof style line */}
            <p className="text-[11px] text-slate-500">
              No setup fees. No long-term commitment. Just a clean way to keep rent
              organized while we finish the payment layer.
            </p>
          </section>

          {/* Right column – feature cards block */}
          <section className="flex-1 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Card 1 */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs font-semibold text-emerald-300 mb-1">
                  For landlords
                </p>
                <p className="text-sm text-slate-100">
                  Properties, tenants, and rent in a single dashboard.
                </p>
                <p className="mt-2 text-[11px] text-slate-500">
                  Add units, track who lives where, see monthly rent totals at a glance,
                  and record payments manually while Stripe integration is in progress.
                </p>
              </div>

              {/* Card 2 */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs font-semibold text-sky-300 mb-1">
                  For tenants
                </p>
                <p className="text-sm text-slate-100">
                  A simple portal to see what&apos;s due.
                </p>
                <p className="mt-2 text-[11px] text-slate-500">
                  Tenants log in to view rent amount, lease dates, and (soon) payment
                  history — with online pay just one step away.
                </p>
              </div>

              {/* Card 3 */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:col-span-2">
                <p className="text-xs font-semibold text-amber-300 mb-1">
                  What&apos;s live now
                </p>
                <ul className="mt-1 space-y-1 text-[12px] text-slate-300">
                  <li>• Landlord dashboard with property and rent tracking</li>
                  <li>• Tenant management and tenant login</li>
                  <li>• Manual payment recording for landlords</li>
                  <li>• Tenant portal with lease and rent details</li>
                </ul>
                <p className="mt-2 text-[11px] text-slate-500">
                  Online card/ACH payments via Stripe are the final layer — the plumbing
                  under everything you see here.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Footer / beta note */}
      <footer className="border-t border-slate-900/80 bg-slate-950/80">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-3 text-[11px] text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <p>RentZentro · Early beta · Do not use for real payments yet.</p>
          <p className="text-slate-600">
            Dashboard + portals are live. Stripe integration comes next.
          </p>
        </div>
      </footer>
    </main>
  );
}

