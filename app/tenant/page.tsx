'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-3xl space-y-10">

        {/* Branding */}
        <section className="space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">
            RentZentro
          </p>

          <h1 className="text-3xl sm:text-4xl font-semibold leading-snug">
            Collect rent online — fast, automated, secure.
          </h1>

          <p className="text-sm text-slate-400 max-w-xl">
            Landlords can manage properties, tenants, and rent tracking. Tenants get a 
            clean, simple portal to view rent, lease dates, and payment history.
            Stripe-powered payments coming soon.
          </p>
        </section>

        {/* Buttons */}
        <section className="flex flex-wrap gap-3">

          {/* LANDLORD BUTTON — updated to /landlord/login */}
          <Link
            href="/landlord/login"
            className="inline-flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-medium px-6 py-2"
          >
            I&apos;m a landlord
          </Link>

          {/* TENANT BUTTON */}
          <Link
            href="/tenant/login"
            className="inline-flex items-center justify-center rounded-full border border-slate-700 hover:bg-slate-900 text-sm px-6 py-2"
          >
            I&apos;m a tenant
          </Link>
        </section>

        {/* Features */}
        <section className="grid gap-3 text-sm text-slate-300">

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="font-medium mb-1">For landlords</p>
            <p className="text-slate-400 text-xs">
              Add properties, manage tenants, track rent, and record payments in one dashboard.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="font-medium mb-1">For tenants</p>
            <p className="text-slate-400 text-xs">
              Log in to view monthly rent, payment history, and lease details.
            </p>
          </div>

        </section>

        <p className="text-[11px] text-slate-500">
          Beta preview. Not for real financial activity yet. Final payment flow launching soon.
        </p>

      </div>
    </main>
  );
}
