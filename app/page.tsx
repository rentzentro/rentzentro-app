import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      {/* Background accents */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.08),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(15,23,42,0.9),_rgba(15,23,42,1))]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex items-center justify-between pb-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/40 shadow-sm shadow-emerald-500/20">
              <span className="text-xs font-bold tracking-tight text-emerald-400">
                RZ
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-slate-50">
                RentZentro
              </p>
              <p className="text-[11px] text-slate-400">
                Rent, tenants & maintenance in one place.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <Link
              href="/landlord/login"
              className="hidden rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800 sm:inline-flex"
            >
              Landlord login
            </Link>
            <Link
              href="/tenant/login"
              className="hidden rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800 sm:inline-flex"
            >
              Tenant login
            </Link>
          </div>
        </header>

        {/* Main content */}
        <div className="grid flex-1 gap-8 pb-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-center">
          {/* Left: Hero + CTAs */}
          <section className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-100 shadow-sm shadow-emerald-500/30">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Built for small landlords who want big-software clarity.
            </div>

            <div className="space-y-4">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl lg:text-[2.5rem]">
                A clean portal for rent, tenants & maintenance—without the
                enterprise headache.
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-slate-300">
                RentZentro gives landlords a clear view of who&apos;s paid,
                what&apos;s due, and which maintenance issues are open. Tenants
                you invite get a simple place to pay rent, see their lease, and
                submit requests—no confusing apps or portals.
              </p>
            </div>

            {/* Primary CTAs */}
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Landlord card */}
              <Link
                href="/landlord/login"
                className="group rounded-2xl border border-emerald-500/50 bg-slate-950/80 p-4 shadow-lg shadow-emerald-500/20 transition-colors hover:border-emerald-400 hover:bg-slate-950"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                      I&apos;m a landlord
                    </p>
                    <p className="mt-1 text-sm text-slate-100">
                      Log in to your dashboard.
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/50 bg-emerald-500/10 text-lg">
                    🏢
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5 text-[11px] text-slate-400">
                  <li className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-emerald-400" />
                    See who has paid, who&apos;s upcoming, and who&apos;s late.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-emerald-400" />
                    Track maintenance requests with status & notes.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-emerald-400" />
                    Share leases & documents directly with tenants.
                  </li>
                </ul>
              </Link>

              {/* Tenant card */}
              <Link
                href="/tenant/login"
                className="group rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-md shadow-black/40 transition-colors hover:border-slate-600 hover:bg-slate-950"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
                      I&apos;m a tenant
                    </p>
                    <p className="mt-1 text-sm text-slate-100">
                      Log in with the invite from your landlord.
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-sky-500/50 bg-sky-500/10 text-lg">
                    🏠
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5 text-[11px] text-slate-400">
                  <li className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-sky-400" />
                    See when rent is due and your current balance.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-sky-400" />
                    Submit maintenance requests.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-sky-400" />
                    Access shared lease documents.
                  </li>
                </ul>
              </Link>
            </div>

            {/* Reassurance row */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Card payments processed securely by Stripe.
              </div>
              <span className="hidden h-3 w-px bg-slate-700 sm:inline-block" />
              <p>Flat $29.95 / month per landlord. No per-unit surprises.</p>
            </div>
          </section>

          {/* Right: Landlord dashboard demo preview (slightly simplified) */}
          <section className="mt-2 md:mt-0">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-2xl shadow-black/50 backdrop-blur">
              {/* Demo header */}
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-200">
                    Landlord dashboard demo
                  </p>
                  <p className="text-[11px] text-slate-500">
                    A peek at what you&apos;ll see after logging in.
                  </p>
                </div>
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                  Sample view
                </span>
              </div>

              {/* Fake app window */}
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/90">
                {/* Top bar */}
                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500/70" />
                    <span className="h-2 w-2 rounded-full bg-amber-400/70" />
                    <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    RentZentro · Landlord dashboard
                  </p>
                  <div className="h-4 w-10" />
                </div>

                <div className="flex">
                  {/* Sidebar */}
                  <aside className="hidden w-28 border-r border-slate-800 bg-slate-950/95 px-2 py-3 text-[10px] text-slate-400 sm:block">
                    <p className="mb-2 px-1 text-[10px] font-semibold tracking-wide text-slate-500">
                      MENU
                    </p>
                    <nav className="space-y-1.5">
                      <div className="rounded-md bg-emerald-500/15 px-2 py-1.5 text-emerald-200 border border-emerald-500/40 text-[10px] font-medium">
                        Dashboard
                      </div>
                      <div className="rounded-md px-2 py-1.5 hover:bg-slate-900/80">
                        Properties
                      </div>
                      <div className="rounded-md px-2 py-1.5 hover:bg-slate-900/80">
                        Tenants
                      </div>
                      <div className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-slate-900/80">
                        <span>Maintenance</span>
                        <span className="rounded-full bg-amber-500/20 px-1.5 text-[9px] text-amber-300">
                          2
                        </span>
                      </div>
                      <div className="rounded-md px-2 py-1.5 hover:bg-slate-900/80">
                        Documents
                      </div>
                    </nav>
                  </aside>

                  {/* Main demo content */}
                  <div className="flex-1 space-y-3 bg-slate-950/80 p-3">
                    {/* Top row: greeting + summary */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-slate-100">
                          Good afternoon, Landlord
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Quick snapshot of rent & maintenance.
                        </p>
                      </div>
                      <div className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-300">
                        Next rent cycle in 12 days
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid gap-2 text-[11px] sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-2.5">
                        <p className="text-slate-400">This month&apos;s rent</p>
                        <p className="mt-1 text-lg font-semibold text-slate-50">
                          $4,250
                        </p>
                        <p className="mt-0.5 text-[10px] text-emerald-300">
                          4 of 5 units paid
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-2.5">
                        <p className="text-slate-400">Open issues</p>
                        <p className="mt-1 text-lg font-semibold text-amber-300">
                          2
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          1 urgent · 1 in progress
                        </p>
                      </div>
                    </div>

                    {/* Maintenance + payments in one simple stack */}
                    <div className="space-y-2 text-[11px]">
                      {/* Maintenance preview */}
                      <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-2.5">
                        <div className="mb-1 flex items-center justify-between">
                          <p className="text-xs font-medium text-slate-100">
                            Maintenance requests
                          </p>
                          <span className="text-[10px] text-slate-500">
                            Preview only
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/90 px-2 py-1.5">
                            <div className="min-w-0">
                              <p className="truncate text-[11px] text-slate-50">
                                Leaky kitchen sink
                              </p>
                              <p className="text-[10px] text-slate-400">
                                Unit 2B · Submitted today
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-medium text-amber-300">
                              In progress
                            </span>
                          </div>

                          <div className="flex items-start justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/90 px-2 py-1.5">
                            <div className="min-w-0">
                              <p className="truncate text-[11px] text-slate-50">
                                Heat not working
                              </p>
                              <p className="text-[10px] text-slate-400">
                                Unit 3A · 2 hrs ago
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] font-medium text-red-300">
                              New
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Recent payments preview */}
                      <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-2.5">
                        <div className="mb-1 flex items-center justify-between">
                          <p className="text-xs font-medium text-slate-100">
                            Recent payments
                          </p>
                          <span className="text-[10px] text-slate-500">
                            Sample data
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/90 px-2 py-1.5">
                            <div>
                              <p className="text-[11px] text-slate-50">
                                $1,050 · Unit 1A
                              </p>
                              <p className="text-[10px] text-slate-400">
                                Paid today · Card
                              </p>
                            </div>
                            <span className="text-[10px] text-emerald-300">
                              On time
                            </span>
                          </div>
                          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/90 px-2 py-1.5">
                            <div>
                              <p className="text-[11px] text-slate-50">
                                $850 · Unit 2B
                              </p>
                              <p className="text-[10px] text-slate-400">
                                Paid yesterday · ACH
                              </p>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              Cleared
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ---- WHY RENTZENTRO SECTION (simpler) ---- */}
        <section className="mb-6 mt-2 rounded-3xl border border-slate-800 bg-slate-950/90 p-5 shadow-inner shadow-black/40">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                Why landlords choose RentZentro
              </p>
              <h2 className="text-base font-semibold text-slate-50 sm:text-lg">
                Clearer than spreadsheets. Simpler than “all-in-one” portals.
              </h2>
            </div>
            <p className="max-w-sm text-[11px] text-slate-400">
              One clean portal for you and your invited tenants at a flat{' '}
              <span className="font-semibold text-slate-100">
                $29.95 / month
              </span>{' '}
              per landlord.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <BenefitRow
              title="Know who has paid in seconds"
              description="See paid, upcoming, and late rent by unit without digging through your bank app or messages."
            />
            <BenefitRow
              title="Requests in one place, not your texts"
              description="Tenants submit maintenance online; you track status and notes instead of juggling calls and screenshots."
            />
            <BenefitRow
              title="Leases and documents stay attached"
              description="Upload key files once and keep them tied to the right property and tenant for easy reference."
            />
            <BenefitRow
              title="Made for owners, not IT teams"
              description="A focused, lightweight experience tuned for small landlords and growing portfolios."
            />
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-2 border-t border-slate-800 pt-5 pb-8 text-center text-[11px] text-slate-500">
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/terms"
              className="hover:text-slate-300 transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              className="hover:text-slate-300 transition-colors"
            >
              Privacy Policy
            </Link>
          </div>
          <p className="mt-3">
            © {new Date().getFullYear()} RentZentro — All rights reserved.
          </p>
        </footer>
      </div>
    </main>
  );
}

function BenefitRow({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-2.5">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-500/50 bg-emerald-500/10 text-xs text-emerald-300">
        ✓
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-slate-50">{title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}
