// app/page.tsx

import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      {/* Top shell */}
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 lg:px-6">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
              <span className="text-lg font-semibold text-emerald-400">RZ</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">
                RentZentro
              </p>
              <p className="text-[11px] text-slate-400">
                Simple rent + maintenance for small landlords
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/landlord/login"
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800"
            >
              Landlord log in
            </Link>
            <Link
              href="/tenant/login"
              className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-emerald-500/60 hover:text-emerald-200"
            >
              Tenant log in
            </Link>
          </div>
        </header>

        {/* Pricing banner */}
        <div className="mb-5 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-slate-900 px-4 py-3 text-xs text-emerald-50 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-slate-950">
                $
              </span>
              <div>
                <p className="text-[13px] font-semibold text-emerald-100">
                  RentZentro Landlord Plan —{' '}
                  <span className="text-emerald-300">$29.95/mo</span>
                </p>
                <p className="text-[11px] text-emerald-100/80">
                  Flat monthly price. Unlimited units, tenants, and maintenance
                  requests.
                </p>
                <div className="mt-1 inline-flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-slate-700/80 bg-slate-950/60 px-2 py-0.5 text-[10px] text-slate-200">
                    <span className="mr-1 h-1.5 w-1.5 rounded-full bg-sky-400" />
                    Powered by Stripe
                  </span>
                  <span className="text-[10px] text-emerald-100/80">
                    Secure card payments for your tenants.
                  </span>
                </div>
              </div>
            </div>
            <Link
              href="/landlord/signup"
              className="rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Start as a landlord
            </Link>
          </div>
        </div>

        {/* Hero + demo */}
        <section className="flex flex-1 flex-col gap-8 pb-10 pt-2 lg:flex-row lg:items-stretch">
          {/* Left: copy + CTAs */}
          <div className="flex flex-1 flex-col justify-center gap-5">
            <div>
              <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl lg:text-[2.6rem]">
                Stop chasing rent. Start running your rentals like a business.
              </h1>
              <p className="mt-3 max-w-xl text-sm text-slate-400">
                RentZentro gives small landlords a clean dashboard, tenant
                portal, online card payments, and maintenance tracking—without
                the corporate bloat.
              </p>
            </div>

            {/* Primary CTAs */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/landlord/signup"
                className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400"
              >
                I&apos;m a landlord
              </Link>
              <Link
                href="/tenant/login"
                className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-800"
              >
                I&apos;m a tenant
              </Link>
              <span className="text-[11px] text-slate-500">
                No setup fees · Cancel anytime
              </span>
            </div>

            {/* Why RentZentro / feature checks */}
            <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  For landlords
                </p>

                <div className="flex items-start gap-2 text-xs text-slate-200">
                  <span className="mt-[1px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] text-emerald-300">
                    ✓
                  </span>
                  <p>
                    See all units, rent statuses, and maintenance in one clean,
                    modern dashboard.
                  </p>
                </div>

                <div className="flex items-start gap-2 text-xs text-slate-200">
                  <span className="mt-[1px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] text-emerald-300">
                    ✓
                  </span>
                  <p>
                    Tenants pay rent with card through Stripe. Payments log
                    automatically to your activity.
                  </p>
                </div>

                <div className="flex items-start gap-2 text-xs text-slate-200">
                  <span className="mt-[1px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] text-emerald-300">
                    ✓
                  </span>
                  <p>
                    Maintenance requests hit your inbox and show up on your
                    maintenance board instantly.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  For tenants
                </p>

                <div className="flex items-start gap-2 text-xs text-slate-200">
                  <span className="mt-[1px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] text-emerald-300">
                    ✓
                  </span>
                  <p>
                    Simple tenant portal to see rent due, payment history, and
                    documents for the unit.
                  </p>
                </div>

                <div className="flex items-start gap-2 text-xs text-slate-200">
                  <span className="mt-[1px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] text-emerald-300">
                    ✓
                  </span>
                  <p>
                    Submit maintenance requests with details. Track status and
                    see landlord notes.
                  </p>
                </div>

                <div className="flex items-start gap-2 text-xs text-slate-200">
                  <span className="mt-[1px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] text-emerald-300">
                    ✓
                  </span>
                  <p>
                    Access shared lease documents in one place, instead of
                    digging through old email threads.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: demo card */}
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-950/70 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.65)]">
              {/* Demo header */}
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Demo snapshot
                  </p>
                  <p className="text-sm font-semibold text-slate-50">
                    Landlord dashboard
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Live rent overview
                </span>
              </div>

              {/* Demo main grid */}
              <div className="grid gap-3 md:grid-cols-[1.4fr_1.1fr]">
                {/* Left: cards */}
                <div className="space-y-3">
                  {/* Summary row */}
                  <div className="grid gap-2 sm:grid-cols-3 text-[11px]">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                        Properties
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-50">
                        12
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        Active rental units
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                        Active tenants
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-50">
                        11
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        In good standing
                      </p>
                    </div>
                    <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-3">
                      <p className="text-[10px] text-emerald-300 uppercase tracking-wide">
                        Monthly rent roll
                      </p>
                      <p className="mt-1 text-lg font-semibold text-emerald-300">
                        $14,750
                      </p>
                      <p className="mt-0.5 text-[10px] text-emerald-100/80">
                        Across all units
                      </p>
                    </div>
                  </div>

                  {/* Rent status */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-medium text-slate-100">
                        Rent status snapshot
                      </p>
                      <span className="text-[10px] text-slate-500">
                        This month
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3 text-[11px]">
                      <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 p-2">
                        <p className="text-[11px] font-semibold text-rose-100">
                          Overdue
                        </p>
                        <p className="mt-1 text-[11px] text-rose-100/90">
                          1 unit · $1,200
                        </p>
                        <p className="mt-0.5 text-[10px] text-rose-200/80">
                          14 Maple · 2B
                        </p>
                      </div>
                      <div className="rounded-2xl border border-amber-500/40 bg-amber-950/40 p-2">
                        <p className="text-[11px] font-semibold text-amber-100">
                          Due in 7 days
                        </p>
                        <p className="mt-1 text-[11px] text-amber-100/90">
                          3 units · $3,450
                        </p>
                        <p className="mt-0.5 text-[10px] text-amber-100/80">
                          Auto-reminders enabled
                        </p>
                      </div>
                      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-2">
                        <p className="text-[11px] font-semibold text-emerald-100">
                          Paid
                        </p>
                        <p className="mt-1 text-[11px] text-emerald-100/90">
                          8 units · $10,100
                        </p>
                        <p className="mt-0.5 text-[10px] text-emerald-100/80">
                          Logged via Stripe
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: recent payments + maintenance */}
                <div className="space-y-3 text-[11px]">
                  {/* Recent payments */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-medium text-slate-100">
                        Recent payments
                      </p>
                      <span className="text-[10px] text-slate-500">
                        Last 5
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        {
                          name: 'J. Smith · 10 Oak · 1A',
                          amount: '$1,050',
                          meta: 'Card • Today · 9:14 AM',
                        },
                        {
                          name: 'L. Rivera · 22 Pine · 3C',
                          amount: '$1,250',
                          meta: 'Card • Yesterday · 4:27 PM',
                        },
                        {
                          name: 'D. Chen · 7 Spruce · 2F',
                          amount: '$975',
                          meta: 'Card • 2 days ago',
                        },
                      ].map((p) => (
                        <div
                          key={p.name}
                          className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-2.5 py-1.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-medium text-slate-100">
                              {p.name}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {p.meta}
                            </p>
                          </div>
                          <p className="shrink-0 text-[11px] font-semibold text-emerald-300">
                            {p.amount}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Maintenance */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-medium text-slate-100">
                        Maintenance queue
                      </p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        1 new
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between rounded-xl border border-amber-500/40 bg-amber-950/40 px-2.5 py-1.5">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-medium text-amber-50">
                            No heat in bedroom
                          </p>
                          <p className="text-[10px] text-amber-100/90">
                            14 Maple · 2B • High priority
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-amber-400/60 bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-50">
                          New
                        </span>
                      </div>
                      <div className="flex items-start justify-between rounded-xl border border-slate-700 bg-slate-950/70 px-2.5 py-1.5">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-medium text-slate-100">
                            Leaky kitchen faucet
                          </p>
                          <p className="text-[10px] text-slate-400">
                            7 Spruce · 2F • In progress
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-sky-400/60 bg-sky-500/15 px-2 py-0.5 text-[10px] text-sky-200">
                          In progress
                        </span>
                      </div>
                    </div>

                    <p className="mt-2 text-[10px] text-slate-500">
                      Tenants submit requests from their portal, and you get
                      notified by email automatically.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mb-8 mt-1 border-t border-slate-900 pt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            How RentZentro fits into your day
          </p>
          <div className="grid gap-4 text-sm md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="mb-1 text-xs font-semibold text-slate-200">
                1. Create your landlord account
              </p>
              <p className="text-[11px] text-slate-400">
                Sign up, subscribe, and add your properties and tenants. It
                takes minutes—not hours.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="mb-1 text-xs font-semibold text-slate-200">
                2. Invite tenants & go live
              </p>
              <p className="text-[11px] text-slate-400">
                RentZentro emails your tenants. They get a simple portal to pay
                rent, view documents, and submit maintenance.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="mb-1 text-xs font-semibold text-slate-200">
                3. See everything in one place
              </p>
              <p className="text-[11px] text-slate-400">
                Log in once a day, check what&apos;s overdue, what&apos;s paid,
                and what needs fixing. No more guessing.
              </p>
            </div>
          </div>
        </section>

        {/* Contact Us */}
        <section className="mb-8 border-t border-slate-900 pt-6">
          <div className="grid gap-6 md:grid-cols-[1.2fr,1.5fr] md:items-start">
            {/* Text block */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Contact RentZentro
              </p>
              <h2 className="text-sm font-semibold text-slate-50">
                Questions about getting started?
              </h2>
              <p className="mt-2 text-[11px] text-slate-400 max-w-sm">
                Whether you manage a single-unit rental or a small portfolio,
                we&apos;re happy to walk you through RentZentro and help you
                decide if it&apos;s a fit.
              </p>

              <div className="mt-4 space-y-1 text-[11px]">
                <p className="text-slate-300 font-medium">Email</p>
                <a
                  href="mailto:info@rentzentro.com"
                  className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
                >
                  info@rentzentro.com
                </a>
              </div>
            </div>

            {/* Simple form (not wired to backend yet) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <form className="space-y-3">
                <div>
                  <label
                    htmlFor="contact-name"
                    className="block text-[11px] font-medium text-slate-300"
                  >
                    Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    placeholder="Your name"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] text-slate-100 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>

                <div>
                  <label
                    htmlFor="contact-email"
                    className="block text-[11px] font-medium text-slate-300"
                  >
                    Email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    placeholder="you@example.com"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] text-slate-100 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>

                <div>
                  <label
                    htmlFor="contact-message"
                    className="block text-[11px] font-medium text-slate-300"
                  >
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    rows={4}
                    placeholder="Tell us a bit about your rentals or what you’re looking for."
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] text-slate-100 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>

                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-[11px] font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950"
                >
                  Send message
                </button>

                <p className="text-[10px] text-slate-500">
                  This form is for general inquiries. For account or billing
                  issues, email{' '}
                  <a
                    href="mailto:info@rentzentro.com"
                    className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
                  >
                    info@rentzentro.com
                  </a>
                  .
                </p>
              </form>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-auto border-t border-slate-900 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <p>© {new Date().getFullYear()} RentZentro. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <Link
                href="/terms"
                className="hover:text-emerald-300 hover:underline"
              >
                Terms of Service
              </Link>
              <Link
                href="/privacy"
                className="hover:text-emerald-300 hover:underline"
              >
                Privacy Policy
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
