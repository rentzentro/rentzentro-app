import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      {/* Top nav */}
      <header className="border-b border-slate-900/80 bg-slate-950/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-emerald-300 text-sm font-bold">
              RZ
            </div>
            <div className="leading-tight">
              <span className="block text-sm font-semibold text-emerald-300 tracking-tight">
                RentZentro
              </span>
              <span className="block text-[11px] text-slate-400">
                Rent payments. Centralized.
              </span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-4 text-xs">
            <a href="#features" className="hidden sm:inline hover:text-emerald-300">
              Features
            </a>
            <a href="#how-it-works" className="hidden sm:inline hover:text-emerald-300">
              How it works
            </a>
            <a href="#who-its-for" className="hidden md:inline hover:text-emerald-300">
              Who it’s for
            </a>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-5 pt-10 pb-16 md:pb-20">
          {/* Hero */}
          <section className="grid md:grid-cols-[1.3fr,1fr] gap-10 md:gap-16 items-center">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300 mb-3">
                STRIPE POWERED • LANDLORD PORTALS • TENANT PAYMENTS
              </p>

              {/* Headline */}
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-slate-50 leading-tight">
                <span className="text-emerald-400">Rent collection</span>{' '}
                without the chaos.
              </h1>

              <p className="mt-4 text-sm md:text-[15px] text-slate-300 max-w-xl">
                A modern way for landlords to track units, tenants, and rent —
                and accept online payments through Stripe. Simple enough for
                single-unit owners. Powerful enough for full portfolios.
              </p>

              {/* CTAs */}
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/landlord/login"
                  className="inline-flex justify-center items-center px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-sm font-semibold hover:bg-emerald-400"
                >
                  I’m a landlord
                </Link>
                <Link
                  href="/tenant/login"
                  className="inline-flex justify-center items-center px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-sm font-semibold text-slate-100 hover:bg-slate-800"
                >
                  I’m a tenant
                </Link>
              </div>

              {/* Subtle pricing note – KEEP */}
              <p className="mt-3 text-[11px] text-slate-500 max-w-md">
                No monthly subscription. RentZentro charges a{' '}
                <span className="text-slate-200 font-medium">
                  2.5% platform fee
                </span>{' '}
                per successful card payment, plus Stripe fees.
              </p>
            </div>

            {/* Credibility block */}
            <div className="md:mt-2">
              <div className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-5 shadow-[0_22px_60px_rgba(0,0,0,0.8)]">
                <p className="text-xs text-slate-400 mb-4">
                  Why landlords trust RentZentro
                </p>
                <ul className="space-y-3 text-[13px] text-slate-300">
                  <li className="flex gap-2">
                    <span className="mt-[3px] h-4 w-4 rounded-full bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center text-[10px] text-emerald-200">
                      ✓
                    </span>
                    <span>Organized, reliable dashboards.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-[3px] h-4 w-4 rounded-full bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center text-[10px] text-emerald-200">
                      ✓
                    </span>
                    <span>Tenants pay online through Stripe Checkout.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-[3px] h-4 w-4 rounded-full bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center text-[10px] text-emerald-200">
                      ✓
                    </span>
                    <span>Payment history syncs automatically.</span>
                  </li>
                </ul>

                <div className="mt-5 rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 text-[11px] text-slate-400">
                  <p className="text-slate-200 font-medium mb-1">Great for:</p>
                  <p>• Single-unit owners</p>
                  <p>• Local portfolios</p>
                  <p>• Large operators with 100+ units</p>
                </div>
              </div>
            </div>
          </section>

          {/* Who it’s for */}
          <section id="who-its-for" className="mt-16">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-3">
              WHO RENTZENTRO IS FOR
            </p>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
                <p className="text-emerald-300 font-semibold mb-1">
                  Independent owners
                </p>
                <p className="text-slate-400 text-[13px]">
                  Stay organized without spreadsheets or scattered apps.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
                <p className="text-emerald-300 font-semibold mb-1">
                  Growing portfolios
                </p>
                <p className="text-slate-400 text-[13px]">
                  Keep dozens or hundreds of units in sync — clean and reliable.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
                <p className="text-emerald-300 font-semibold mb-1">
                  Modern tenants
                </p>
                <p className="text-slate-400 text-[13px]">
                  A simple portal: see rent, pay online, done.
                </p>
              </div>
            </div>
          </section>

          {/* CORE FEATURES — simplified list */}
          <section id="features" className="mt-16">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-3">
              CORE FEATURES
            </p>

            <div className="rounded-3xl bg-slate-950 border border-slate-800 p-6 text-sm">
              <ul className="space-y-3 text-slate-300 text-[14px]">
                <li>• Track properties, units, and tenants</li>
                <li>• Online card payments through Stripe</li>
                <li>• Automated payment sync via webhooks</li>
                <li>• Dashboard: overdue, upcoming, and current rent</li>
                <li>• Clean tenant portal with real-time balance</li>
                <li>• Full payment history with timestamps</li>
                <li>• Secure data storage powered by Supabase</li>
              </ul>
            </div>
          </section>

          {/* How it works */}
          <section id="how-it-works" className="mt-16">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-3">
              HOW IT WORKS
            </p>

            <div className="rounded-3xl bg-slate-950 border border-slate-800 p-5 md:p-6">
              <div className="grid md:grid-cols-3 gap-5 text-sm">
                <div>
                  <p className="text-slate-200 font-semibold mb-1">
                    1. Add your portfolio
                  </p>
                  <p className="text-slate-400 text-[13px]">
                    Add properties, units, and tenants in minutes.
                  </p>
                </div>
                <div>
                  <p className="text-slate-200 font-semibold mb-1">
                    2. Tenants pay online
                  </p>
                  <p className="text-slate-400 text-[13px]">
                    Stripe Checkout handles secure card payments.
                  </p>
                </div>
                <div>
                  <p className="text-slate-200 font-semibold mb-1">
                    3. Everything syncs
                  </p>
                  <p className="text-slate-400 text-[13px]">
                    Payment history instantly updates your dashboard.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-5 text-xs text-slate-500 mt-2">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} RentZentro. All rights reserved.
          </span>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-slate-300">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-slate-300">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
