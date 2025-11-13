// app/page.tsx

import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-3xl bg-slate-900/70 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        
        {/* Logo / Brand */}
        <div className="flex items-center gap-2 mb-6">
          <div className="h-10 w-10 rounded-xl bg-teal-400 flex items-center justify-center text-slate-900 font-bold">
            RZ
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              <span className="text-slate-50">Rent</span>
              <span className="text-teal-400">Zentro</span>
            </h1>
            <p className="text-sm text-slate-400">Simple, automatic rent payments.</p>
          </div>
        </div>

        {/* Hero */}
        <section className="space-y-4 mb-8">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Collect rent online — fast, automatic, secure.
          </h2>
          <p className="text-slate-300 max-w-2xl">
            Tenants pay by bank or card. Landlords get paid automatically. 
            You keep 98% of your rent with a simple 2.5% fee per transaction.
          </p>
        </section>

        {/* CTAs */}
        <div className="flex flex-wrap gap-3 mb-8">
          
          <Link href="/landlord">
            <button className="px-5 py-2.5 rounded-full bg-teal-400 text-slate-900 font-semibold text-sm hover:bg-teal-300 transition">
              I&apos;m a landlord
            </button>
          </Link>

          <Link href="/tenant">
            <button className="px-5 py-2.5 rounded-full border border-slate-600 text-slate-100 text-sm hover:bg-slate-800 transition">
              I&apos;m a tenant
            </button>
          </Link>

        </div>

        {/* 3-columns: How it works */}
        <section className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <h3 className="font-semibold mb-1">Connect your bank</h3>
            <p className="text-slate-400">
              Secure onboarding for landlords using Stripe — we never store your bank details.
            </p>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <h3 className="font-semibold mb-1">Invite your tenants</h3>
            <p className="text-slate-400">
              Send each tenant a payment link or portal login in just a few clicks.
            </p>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <h3 className="font-semibold mb-1">Rent. On autopilot.</h3>
            <p className="text-slate-400">
              Automatic charges, reminders, and receipts so rent day just happens.
            </p>
          </div>
        </section>

        {/* Footer */}
        <p className="mt-6 text-xs text-slate-500">
          Powered by Stripe. RentZentro is currently in beta — not financial advice.
        </p>

      </div>
    </main>
  );
}
