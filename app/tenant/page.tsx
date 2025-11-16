'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-3xl space-y-10">
        {/* Hero */}
        <section className="space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">
            RentZentro
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold">
            Collect rent online — fast, automatic, secure.
          </h1>
          <p className="text-sm text-slate-400 max-w-xl">
            Landlords can track properties, tenants, and rent payments in one place.
            Tenants get a simple portal to see what&apos;s due and when. Stripe-powered
            payments coming soon.
          </p>
        </section>

        {/* Role buttons */}
        <section className="flex flex-wrap gap-3">
          <Link
            href="/landlord"
            className="inline-flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-medium px-6 py-2"
          >
            I&apos;m a landlord
          </Link>

          <Link
            href="/tenant/login"
            className="inline-flex items-center justify-center rounded-full border border-slate-700 hover:bg-slate-900 text-sm px-6 py-2"
          >
            I&apos;m a tenant
          </Link>
        </section>

        {/* Simple feature bullets */}
        <section className="grid gap-3 text-sm text-slate-300">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="font-medium mb-1">For landlords</p>
            <p className="text-slate-400 text-xs">
              Add properties, manage tenants, and see monthly rent totals at a glance.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="font-medium mb-1">For tenants</p>
            <p className="text-slate-400 text-xs">
              Log in to view your unit, rent amount, and lease dates. Online pay coming soon.
            </p>
          </div>
        </section>

        <p className="text-[11px] text-slate-500">
          Beta preview. Data is for demonstration only — do not use for real financial
          activity yet.
        </p>
      </div>
    </main>
  );
}
