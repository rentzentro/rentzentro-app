'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      {/* Top nav */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 text-xs font-extrabold">
              RZ
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">
                RentZentro
              </p>
              <p className="text-[11px] text-slate-400 -mt-0.5">
                Simple rent collection for small landlords
              </p>
            </div>
          </div>

          <nav className="hidden sm:flex items-center gap-6 text-[11px] text-slate-400">
            <a href="#features" className="hover:text-emerald-300">
              Features
            </a>
            <a href="#pricing" className="hover:text-emerald-300">
              Pricing
            </a>
            <a href="#how-it-works" className="hover:text-emerald-300">
              How it works
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/landlord/login"
              className="hidden sm:inline-flex rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800"
            >
              Landlord login
            </Link>
            <Link
              href="/tenant/login"
              className="inline-flex rounded-full border border-slate-800 bg-slate-950 px-3 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-slate-900"
            >
              Tenant login
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 lg:py-10 space-y-10">
          {/* Hero */}
          <section className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)] items-start">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-[11px] text-emerald-100 font-medium">
                  Built for small landlords · No setup fees
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-slate-50">
                Collect rent online without buying a full property-management
                empire.
              </h1>

              <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
                RentZentro gives you the parts you actually need—online rent
                payments, tenant portal, maintenance tracking, and receipts—
                without the bloated software and $100+/month price tags.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/landlord/login"
                  className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400"
                >
                  I&apos;m a landlord
                </Link>
                <Link
                  href="/tenant/login"
                  className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-800"
                >
                  I&apos;m a tenant
                </Link>
              </div>

              <p className="text-[11px] text-slate-500 max-w-md">
                Landlords create a free account first. Subscription billing
                happens later from inside your secure dashboard—never on this
                public landing page.
              </p>
            </div>

            {/* Fake dashboard preview */}
            <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 shadow-lg shadow-emerald-500/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-slate-400">Landlord demo</p>
                  <p className="text-sm font-semibold text-slate-50">
                    Portfolio overview
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500/10 text-emerald-200 text-[11px] px-2 py-1 border border-emerald-500/40">
                  Sample view
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between rounded-xl bg-slate-950/70 border border-slate-800 px-3 py-2">
                  <div>
                    <p className="text-slate-400 text-[11px]">
                      This month&apos;s rent
                    </p>
                    <p className="text-sm font-semibold text-slate-50">
                      $4,250.00
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-emerald-300">92% collected</p>
                    <p className="text-[11px] text-slate-500">
                      1 payment overdue
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
                    <p className="text-[11px] text-slate-400">
                      Upcoming payments
                    </p>
                    <p className="mt-1 text-sm text-slate-50 font-medium">
                      3 tenants
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Next due Jan 1
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
                    <p className="text-[11px] text-slate-400">Open requests</p>
                    <p className="mt-1 text-sm text-slate-50 font-medium">
                      2 issues
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Plumbing · Heating
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
                  <p className="text-[11px] text-slate-400 mb-1">
                    Tenant portal preview
                  </p>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300">
                      Download receipts, view balance, submit maintenance.
                    </span>
                    <span className="hidden sm:inline text-emerald-300">
                      Clean & simple.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Features */}
          <section id="features" className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-50">
              What you get with RentZentro
            </h2>

            <div className="grid gap-4 md:grid-cols-2 text-sm">
              <div className="space-y-3">
                <FeatureItem
                  title="Online rent payments"
                  body="Secure card payments via Stripe, plus support for manual payments so your records stay clean."
                />
                <FeatureItem
                  title="Tenant portal"
                  body="Tenants can log in to see their balance, payment history, documents, and maintenance requests."
                />
                <FeatureItem
                  title="Maintenance tracking + email alerts"
                  body="Tenants submit requests, you get an email, and both sides can follow the status without messy text threads."
                />
                <FeatureItem
                  title="Receipts & payment history"
                  body="Automatic receipts and a clear history for every unit to keep everyone on the same page."
                />
              </div>

              <div className="space-y-3">
                <FeatureItem
                  title="Property & unit overview"
                  body="See current rent, next due date, and status at a glance for each unit you manage."
                />
                <FeatureItem
                  title="Document sharing"
                  body="Upload leases or addenda once and let tenants view them securely in their portal."
                />
                <FeatureItem
                  title="Straightforward pricing"
                  body="$29.95/month for landlords, plus standard Stripe card fees. No per-tenant or per-unit surprises."
                />
                <FeatureItem
                  title="Designed for growth"
                  body="Start with a few units and grow. RentZentro is built to scale with you—not get in your way."
                />
              </div>
            </div>
          </section>

          {/* Pricing – info only, no checkout here */}
          <section id="pricing" className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-50">
              Simple pricing when you&apos;re ready
            </h2>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-50">
                  RentZentro Landlord Plan
                </p>
                <p className="mt-1 text-2xl font-semibold text-emerald-300">
                  $29.95
                  <span className="text-sm text-slate-400 font-normal">
                    {' '}
                    / month
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-400 max-w-md">
                  Pricing is activated from inside your landlord dashboard after
                  you create an account. No one can start a subscription from
                  this public page.
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <Link
                  href="/landlord/login"
                  className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
                >
                  Create or access landlord account
                </Link>
                <p className="text-[11px] text-slate-500">
                  You&apos;ll see subscription options in{' '}
                  <span className="font-medium text-slate-300">
                    Settings &gt; Subscription
                  </span>{' '}
                  after you&apos;re logged in.
                </p>
              </div>
            </div>
          </section>

          {/* How it works */}
          <section id="how-it-works" className="space-y-3 text-sm">
            <h2 className="text-lg font-semibold text-slate-50">
              How RentZentro fits into your workflow
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-slate-300">
              <li>Create a landlord account and add your properties & tenants.</li>
              <li>
                Invite tenants; they get a secure portal to pay rent and submit
                requests.
              </li>
              <li>
                When you&apos;re ready, enable the $29.95/month plan from
                Settings to unlock full online payments and automation.
              </li>
            </ol>
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            &copy; {new Date().getFullYear()} RentZentro. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <Link href="/terms" className="hover:text-emerald-300">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-emerald-300">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function FeatureItem({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-1 h-5 w-5 rounded-full border border-emerald-500/60 bg-emerald-500/10 flex items-center justify-center text-[11px] text-emerald-200">
        ✓
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-50">{title}</p>
        <p className="mt-0.5 text-xs text-slate-400">{body}</p>
      </div>
    </div>
  );
}
