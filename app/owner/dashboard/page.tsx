// app/owner/dashboard/page.tsx

import Link from 'next/link';

export default function OwnerDashboardPage() {
  const year = new Date().getFullYear();

  // NOTE: These are placeholder / sample numbers.
  // You can wire these up to real metrics later.
  const metrics = {
    landlords: 1,
    activeSubscriptions: 1,
    monthlyRecurringRevenue: 29.95,
    activeTenants: 3,
    units: 3,
    stripeVolumeThisMonth: 31.0,
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 lg:px-6">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
              <span className="text-lg font-semibold text-emerald-400">RZ</span>
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Link href="/" className="hover:text-emerald-300">
                  Home
                </Link>
                <span>/</span>
                <span className="text-slate-400">Owner</span>
                <span>/</span>
                <span className="text-slate-200">Dashboard</span>
              </div>
              <p className="text-sm font-semibold tracking-tight text-slate-50">
                RentZentro Owner Dashboard
              </p>
              <p className="text-[11px] text-slate-500">
                Private overview just for you — not visible to landlords or
                tenants.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 text-right">
            <span className="text-[11px] text-slate-500 uppercase tracking-wide">
              Internal view
            </span>
            <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
              Building mode · {year}
            </span>
          </div>
        </header>

        {/* Top metrics */}
        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm">
            <p className="text-[11px] text-slate-500 uppercase tracking-wide">
              Landlords
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">
              {metrics.landlords}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Total landlord accounts created.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm">
            <p className="text-[11px] text-slate-500 uppercase tracking-wide">
              Active subscriptions
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-300">
              {metrics.activeSubscriptions}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Landlords fully subscribed and live.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-4 shadow-sm">
            <p className="text-[11px] text-emerald-300 uppercase tracking-wide">
              Monthly recurring revenue
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-200">
              ${metrics.monthlyRecurringRevenue.toFixed(2)}
            </p>
            <p className="mt-1 text-[11px] text-emerald-100/80">
              At $29.95/mo per active landlord.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm">
            <p className="text-[11px] text-slate-500 uppercase tracking-wide">
              Stripe volume (this month)
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">
              ${metrics.stripeVolumeThisMonth.toFixed(2)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Total rent processed via Stripe.
            </p>
          </div>
        </section>

        {/* Middle grid */}
        <section className="mb-6 grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)]">
          {/* Product health & flows */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                    Product health
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-50">
                    Core flows you&apos;ve shipped
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Live in production
                </span>
              </div>

              <div className="space-y-2 text-[11px]">
                {[
                  {
                    label: 'Landlord signup + subscription (Stripe Checkout)',
                    status: 'Live',
                    note: 'Required before accessing dashboard.',
                  },
                  {
                    label: 'Landlord dashboard, properties, tenants, payments',
                    status: 'Live',
                    note: 'RLS in place, metrics showing correctly.',
                  },
                  {
                    label: 'Tenant portal (rent, documents, maintenance)',
                    status: 'Live',
                    note: 'Auto-linking tenant row to auth user.',
                  },
                  {
                    label: 'Stripe card payments for rent',
                    status: 'Live',
                    note: 'Webhook updating Supabase payments table.',
                  },
                  {
                    label: 'Maintenance emails via Resend',
                    status: 'Live',
                    note: 'Tenant → landlord email flowing correctly.',
                  },
                  {
                    label: 'Document upload + tenant access',
                    status: 'Live',
                    note: 'Docs tied to property and visible in portal.',
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-[3px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] text-emerald-300">
                        ✓
                      </span>
                      <div>
                        <p className="text-[11px] font-medium text-slate-100">
                          {item.label}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {item.note}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Growth focus */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                  Growth focus
                </p>
                <span className="text-[10px] text-slate-500">
                  Next 30–90 days
                </span>
              </div>
              <div className="grid gap-3 text-[11px] sm:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                  <p className="text-[11px] font-semibold text-slate-100">
                    Fill the funnel
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Trade shows, Facebook ads, direct outreach to local
                    landlords managing 1–50 units.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                  <p className="text-[11px] font-semibold text-slate-100">
                    Perfect onboarding
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Make sure a new landlord can go from signup → subscribed →
                    first payment in minutes.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                  <p className="text-[11px] font-semibold text-slate-100">
                    Learn from real usage
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Watch where people click, what confuses them, and keep
                    polishing based on real feedback.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Checklist / quick links */}
          <div className="space-y-4">
            {/* Launch checklist */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                  Launch checklist
                </p>
                <span className="text-[11px] text-emerald-300">
                  You&apos;re basically live ✅
                </span>
              </div>

              <div className="space-y-2 text-[11px]">
                {[
                  {
                    label: 'Core landlord + tenant flows working end-to-end',
                    done: true,
                  },
                  {
                    label: 'Stripe Checkout + subscription webhook connected',
                    done: true,
                  },
                  {
                    label: 'RLS configured for core tables (landlords, tenants, properties, payments, maintenance, documents)',
                    done: true,
                  },
                  {
                    label: 'Landing page explains value + price clearly',
                    done: true,
                  },
                  {
                    label: 'Social media / launch post drafted',
                    done: false,
                  },
                  {
                    label: 'First 5–10 real landlords to invite',
                    done: false,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2"
                  >
                    <span
                      className={`mt-[2px] inline-flex h-4 w-4 items-center justify-center rounded-full text-[11px] ${
                        item.done
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {item.done ? '✓' : '●'}
                    </span>
                    <p
                      className={`text-[11px] ${
                        item.done ? 'text-slate-200' : 'text-slate-400'
                      }`}
                    >
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick links */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
              <p className="mb-2 text-[11px] text-slate-500 uppercase tracking-wide">
                Quick links
              </p>
              <div className="space-y-1.5 text-[11px]">
                <Link
                  href="/"
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 hover:border-emerald-500/50 hover:text-emerald-200"
                >
                  <span>View public landing page</span>
                  <span className="text-[10px] text-slate-500">/</span>
                </Link>
                <Link
                  href="/landlord/login"
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 hover:border-emerald-500/50 hover:text-emerald-200"
                >
                  <span>Test landlord login</span>
                  <span className="text-[10px] text-slate-500">
                    /landlord/login
                  </span>
                </Link>
                <Link
                  href="/tenant/login"
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 hover:border-emerald-500/50 hover:text-emerald-200"
                >
                  <span>Test tenant login</span>
                  <span className="text-[10px] text-slate-500">
                    /tenant/login
                  </span>
                </Link>
                <Link
                  href="/landlord/signup"
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 hover:border-emerald-500/50 hover:text-emerald-200"
                >
                  <span>Walk through new landlord signup flow</span>
                  <span className="text-[10px] text-slate-500">
                    /landlord/signup
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-auto border-t border-slate-900 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <p>
              © {year} RentZentro owner dashboard · For your eyes only 👀
            </p>
            <div className="flex items-center gap-3">
              <span className="text-slate-600">
                Powered by Stripe · Supabase · Vercel
              </span>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
