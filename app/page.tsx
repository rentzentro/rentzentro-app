// app/page.tsx
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'RentZentro | Rent collection, tenant portal, maintenance, listings & e-sign',
  description:
    'RentZentro is software for landlords (not a property management company). Collect rent online (ACH + card), enable auto-pay, send reminders, track maintenance, share documents, message tenants, publish listings, and manage e-signatures—without the corporate bloat.',
  alternates: {
    canonical: 'https://www.rentzentro.com/',
  },
  openGraph: {
    title: 'RentZentro | Run rentals like a business',
    description:
      'Collect rent online, enable auto-pay, send reminders, track maintenance, share documents, message tenants, publish listings, and manage e-signatures.',
    url: 'https://www.rentzentro.com/',
    siteName: 'RentZentro',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RentZentro | Run rentals like a business',
    description:
      'Rent collection + tenant portal + maintenance + listings + e-signatures—built for landlords.',
  },
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  { auth: { persistSession: false } }
);

type Listing = {
  id: number;
  title: string;
  slug: string;
  published: boolean;
  published_at: string | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  rent_amount: number | null;
  beds: number | null;
  baths: number | null;
  available_date: string | null;
  hide_exact_address: boolean;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
};

type PhotoRow = {
  id: number;
  listing_id: number;
  image_url: string;
  sort_order: number;
};

const money = (v: number | null | undefined) =>
  v == null || isNaN(v) ? null : `$${v.toLocaleString('en-US')}`;

const fmtDate = (value: string | null | undefined) => {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

async function getHomepageListings(limit = 6) {
  const { data: listings, error } = await supabase
    .from('listings')
    .select(
      `
      id, title, slug, published, published_at,
      city, state, neighborhood,
      rent_amount, beds, baths, available_date,
      hide_exact_address, address_line1, address_line2, postal_code
    `
    )
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const ids = (listings || []).map((l: any) => l.id).filter(Boolean);
  if (ids.length === 0) {
    return { listings: (listings || []) as Listing[], coverMap: new Map<number, PhotoRow>() };
  }

  const { data: photos, error: pErr } = await supabase
    .from('listing_photos')
    .select('id, listing_id, image_url, sort_order')
    .in('listing_id', ids)
    .order('sort_order', { ascending: true });

  if (pErr) throw pErr;

  const coverMap = new Map<number, PhotoRow>();
  for (const row of (photos || []) as PhotoRow[]) {
    if (!coverMap.has(row.listing_id)) coverMap.set(row.listing_id, row);
  }

  return { listings: (listings || []) as Listing[], coverMap };
}

type DemoCard = {
  title: string;
  loc: string;
  price: string;
  bedsBaths: string;
  available: string;
  area: string;
  image: string;
};

const demoCards: DemoCard[] = [
  {
    title: 'Bright 2BR • Renovated kitchen • Parking',
    loc: 'East Side, Providence, RI',
    price: '$2,350/mo',
    bedsBaths: '2 / 1',
    available: 'Now',
    area: 'East Side, Providence, RI',
    image:
      'https://images.unsplash.com/photo-1501183638710-841dd1904471?auto=format&fit=crop&w=1400&q=70',
  },
  {
    title: 'Modern 1BR • In-unit laundry • Gym access',
    loc: 'Somerville, MA',
    price: '$2,150/mo',
    bedsBaths: '1 / 1',
    available: 'Jan 5, 2026',
    area: 'Somerville, MA',
    image:
      'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1400&q=70',
  },
  {
    title: 'Spacious 3BR • Backyard • Pet-friendly',
    loc: 'Warwick, RI',
    price: '$2,850/mo',
    bedsBaths: '3 / 1.5',
    available: 'Feb 1, 2026',
    area: 'Warwick, RI',
    image:
      'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=70',
  },
];

function DemoListingCard({ d }: { d: DemoCard }) {
  return (
    <div className="group overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70">
      <div className="relative h-44 w-full overflow-hidden bg-slate-950/50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={d.image}
          alt="Example rental listing preview"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          loading="lazy"
        />
        <div className="absolute left-3 top-3 inline-flex items-center rounded-full border border-slate-700 bg-black/40 px-2.5 py-1 text-[10px] font-semibold text-slate-100 backdrop-blur">
          {d.price}
        </div>

        <div className="absolute right-3 top-3 inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200 backdrop-blur">
          Example
        </div>
      </div>

      <div className="p-4">
        <p className="text-sm font-semibold text-slate-50">{d.title}</p>
        <p className="mt-1 text-[12px] text-slate-300">{d.loc}</p>

        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-2">
            <p className="text-slate-500">Beds / Baths</p>
            <p className="mt-0.5 text-slate-100 font-semibold">{d.bedsBaths}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-2">
            <p className="text-slate-500">Available</p>
            <p className="mt-0.5 text-slate-100 font-semibold">{d.available}</p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-2">
          <p className="text-[11px] text-slate-500">Area</p>
          <p className="mt-0.5 text-[12px] text-slate-200">{d.area}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Exact address hidden until a showing is scheduled.
          </p>
        </div>

        <div className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold text-emerald-200">
          Preview style <span className="text-emerald-300">→</span>
        </div>
      </div>
    </div>
  );
}

export default async function HomePage() {
  let publicListings: Listing[] = [];
  let coverMap = new Map<number, PhotoRow>();

  try {
    const res = await getHomepageListings(6);
    publicListings = res.listings;
    coverMap = res.coverMap;
  } catch {
    publicListings = [];
    coverMap = new Map<number, PhotoRow>();
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'RentZentro',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: 'https://www.rentzentro.com/',
    description:
      'RentZentro is software for landlords (not a property management company). Collect rent online (ACH + card), enable auto-pay, send reminders, track maintenance, share documents, message tenants, publish listings, and manage e-signatures.',
    offers: {
      '@type': 'Offer',
      price: '29.95',
      priceCurrency: 'USD',
      url: 'https://www.rentzentro.com/landlord/signup',
    },
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Top shell */}
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 lg:px-6">
        {/* Holiday promo ribbon */}
        <div className="mb-4 rounded-full border border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-slate-900 px-4 py-2 text-center text-[11px] font-medium text-emerald-100 shadow-sm">
          🎄 December special:{' '}
          <span className="font-semibold text-emerald-300">
            Free RentZentro for new landlords now through all December — no card required.
          </span>{' '}
          $29.95/mo to continue after the free period.
        </div>

        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
              <span className="text-lg font-semibold text-emerald-400">RZ</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">RentZentro</p>
              <p className="text-[11px] text-slate-400">
                Confidence, simplicity, and control for every landlord
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
            <Link
              href="/team/login"
              className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-emerald-500/60 hover:text-emerald-200"
            >
              Team member log in
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
                  RentZentro Landlord Plan — <span className="text-emerald-300">$29.95/mo</span>
                </p>
                <p className="text-[11px] text-emerald-100/80">
                  Flat monthly price. Unlimited units, tenants, payments, maintenance requests, listings, and more.
                </p>
                <p className="mt-1 text-[11px] font-medium text-emerald-200">
                  🎁 Free for new landlords through December — no card required to start.
                </p>
                <div className="mt-1 inline-flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-slate-700/80 bg-slate-950/60 px-2 py-0.5 text-[10px] text-slate-200">
                    <span className="mr-1 h-1.5 w-1.5 rounded-full bg-sky-400" />
                    Powered by Stripe
                  </span>
                  <span className="text-[10px] text-emerald-100/80">
                    Secure card & ACH rent payments, including automatic rent payments (auto-pay).
                  </span>
                </div>
              </div>
            </div>
            <Link
              href="/landlord/signup"
              className="rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Start free in December
            </Link>
          </div>
        </div>

        {/* Hero + demo */}
        <section className="flex flex-1 flex-col gap-8 pb-10 pt-2 lg:flex-row lg:items-stretch">
          {/* Left */}
          <div className="flex flex-1 flex-col justify-center gap-5">
            <div>
              <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl lg:text-[2.6rem]">
                Rent collection software for landlords — plus listings and e-sign.
              </h1>
              <p className="mt-3 max-w-xl text-sm text-slate-400">
                RentZentro is software for landlords—not a management company. Collect rent online (ACH + card),
                enable auto-pay, send reminders, track maintenance, share documents, message tenants, publish
                listings, and manage e-signatures without the corporate bloat.
              </p>
            </div>

            {/* Primary CTAs */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/landlord/signup"
                className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400"
              >
                Start free in December
              </Link>
              <Link
                href="/tenant/login"
                className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-800"
              >
                I&apos;m a tenant
              </Link>
              <Link
                href="/listings"
                className="inline-flex items-center justify-center rounded-full border border-emerald-500/50 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/15"
              >
                Browse rentals
              </Link>

              <span className="text-[11px] text-slate-500">No card required · Cancel anytime</span>
            </div>

            <p className="mt-1 text-[11px] text-emerald-300">
              Portfolios with 50+ properties are actively managed through RentZentro.
            </p>

            {/* Features */}
            <section className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
              <div className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  For landlords
                </h2>

                {[
                  'See all units, rent statuses, and maintenance requests in one clean, modern dashboard.',
                  'Tenants pay rent online with card or ACH through Stripe. Payments log automatically—RentZentro never holds your funds.',
                  'Offer tenants automatic rent payments (auto-pay) so on-time rent becomes the default.',
                  'Publish a rental listing with photos and share it by link (plus show on the public listings page).',
                  'Send leases and documents for e-signatures and track signature status in one place.',
                  'Built-in messaging with each tenant, so questions, updates, and photos stay in one thread.',
                  'Add trusted team members to help manage rent, maintenance, listings, and messaging.',
                ].map((t) => (
                  <div key={t} className="flex items-start gap-2 text-xs text-slate-200">
                    <span className="mt-[1px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] text-emerald-300">
                      ✓
                    </span>
                    <p>{t}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  For tenants
                </h2>

                {[
                  'Simple tenant portal to see rent due, payment history, and shared documents—and pay rent online with card or bank (ACH).',
                  'Set up auto-pay (if enabled by your landlord) and avoid late fees and reminders.',
                  'Submit maintenance requests with details, then track status and see updates.',
                  'View and sign lease documents electronically (e-sign) when your landlord sends them.',
                  'Secure in-app messaging to ask questions or share photos without hunting through old text messages.',
                ].map((t) => (
                  <div key={t} className="flex items-start gap-2 text-xs text-slate-200">
                    <span className="mt-[1px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] text-emerald-300">
                      ✓
                    </span>
                    <p>{t}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right: demo card */}
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-950/70 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.65)]">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Demo snapshot</p>
                  <p className="text-sm font-semibold text-slate-50">Landlord dashboard</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Live rent overview
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-[1.4fr_1.1fr]">
                <div className="space-y-3">
                  <div className="grid gap-2 text-[11px] sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">Properties</p>
                      <p className="mt-1 text-lg font-semibold text-slate-50">12</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">Active rental units</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">Active tenants</p>
                      <p className="mt-1 text-lg font-semibold text-slate-50">11</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">In good standing</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-3">
                      <p className="text-[10px] text-emerald-300 uppercase tracking-wide">Monthly rent roll</p>
                      <p className="mt-1 text-lg font-semibold text-emerald-300">$14,750</p>
                      <p className="mt-0.5 text-[10px] text-emerald-100/80">Across all units</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-medium text-slate-100">Rent status snapshot</p>
                      <span className="text-[10px] text-slate-500">This month</span>
                    </div>
                    <div className="grid gap-2 text-[11px] sm:grid-cols-3">
                      <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 p-2">
                        <p className="text-[11px] font-semibold text-rose-100">Overdue</p>
                        <p className="mt-1 text-[11px] text-rose-100/90">1 unit · $1,200</p>
                        <p className="mt-0.5 text-[10px] text-rose-200/80">14 Maple · 2B</p>
                      </div>
                      <div className="rounded-2xl border border-amber-500/40 bg-amber-950/40 p-2">
                        <p className="text-[11px] font-semibold text-amber-100">Due in 7 days</p>
                        <p className="mt-1 text-[11px] text-amber-100/90">3 units · $3,450</p>
                        <p className="mt-0.5 text-[10px] text-amber-100/80">Auto-reminders enabled</p>
                      </div>
                      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-2">
                        <p className="text-[11px] font-semibold text-emerald-100">Paid</p>
                        <p className="mt-1 text-[11px] text-emerald-100/90">8 units · $10,100</p>
                        <p className="mt-0.5 text-[10px] text-emerald-100/80">Logged via Stripe</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 text-[11px]">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-medium text-slate-100">Recent payments</p>
                      <span className="text-[10px] text-slate-500">Last 5</span>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { name: 'J. Smith · 10 Oak · 1A', amount: '$1,050', meta: 'Card • Today · 9:14 AM' },
                        { name: 'L. Rivera · 22 Pine · 3C', amount: '$1,250', meta: 'ACH • Yesterday · 4:27 PM' },
                        { name: 'D. Chen · 7 Spruce · 2F', amount: '$975', meta: 'Card • 2 days ago' },
                      ].map((p) => (
                        <div
                          key={p.name}
                          className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-2.5 py-1.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-medium text-slate-100">{p.name}</p>
                            <p className="text-[10px] text-slate-500">{p.meta}</p>
                          </div>
                          <p className="shrink-0 text-[11px] font-semibold text-emerald-300">{p.amount}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-medium text-slate-100">Maintenance queue</p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        1 new
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between rounded-xl border border-amber-500/40 bg-amber-950/40 px-2.5 py-1.5">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-medium text-amber-50">No heat in bedroom</p>
                          <p className="text-[10px] text-amber-100/90">14 Maple · 2B • High priority</p>
                        </div>
                        <span className="shrink-0 rounded-full border border-amber-400/60 bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-50">
                          New
                        </span>
                      </div>
                      <div className="flex items-start justify-between rounded-xl border border-slate-700 bg-slate-950/70 px-2.5 py-1.5">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-medium text-slate-100">Leaky kitchen faucet</p>
                          <p className="text-[10px] text-slate-400">7 Spruce · 2F • In progress</p>
                        </div>
                        <span className="shrink-0 rounded-full border border-sky-400/60 bg-sky-500/15 px-2 py-0.5 text-[10px] text-sky-200">
                          In progress
                        </span>
                      </div>
                    </div>

                    <p className="mt-2 text-[10px] text-slate-500">
                      Tenants submit requests from their portal, and you get notified by email automatically.
                    </p>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-[10px] text-slate-500">
                Built for landlords who want control—without a complicated property management platform.
              </p>
            </div>
          </div>
        </section>

        {/* Public Listings Preview */}
        <section className="mb-8 border-t border-slate-900 pt-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Public listings
              </h2>
              <p className="text-lg font-semibold text-slate-50">Browse rentals</p>
              <p className="mt-2 text-[11px] text-slate-400">
                RentZentro landlords can publish listings with photos and share them by link. Published rentals may appear
                here and on the public browse page.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/listings"
                className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Browse all listings
              </Link>
            </div>
          </div>

          {publicListings.length === 0 ? (
            <>
              <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">Listing preview</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Here’s what RentZentro listings look like. Real published listings will show here automatically.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/landlord/signup"
                      className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15"
                    >
                      Publish your first listing
                    </Link>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {demoCards.map((d) => (
                  <DemoListingCard key={d.title} d={d} />
                ))}
              </div>

              <p className="mt-3 text-[10px] text-slate-500">
                Note: Example listings above are demos for presentation. Real listings are published by individual landlords.
                RentZentro is software for managing rentals — not a property management company.
              </p>
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {publicListings.map((l) => {
                  const cover = coverMap.get(l.id);
                  const loc = [l.neighborhood, l.city, l.state].filter(Boolean).join(', ');
                  const price = money(l.rent_amount);
                  const available = fmtDate(l.available_date) || 'Now';

                  const addressLine = l.hide_exact_address
                    ? [l.neighborhood, l.city, l.state].filter(Boolean).join(', ')
                    : [l.address_line1, l.address_line2, l.city, l.state, l.postal_code]
                        .filter(Boolean)
                        .join(', ');

                  return (
                    <Link
                      key={l.id}
                      href={`/listings/${l.slug}`}
                      className="group overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 hover:bg-slate-900/55 transition-colors"
                    >
                      <div className="relative h-44 w-full overflow-hidden bg-slate-950/50">
                        {cover?.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={cover.image_url}
                            alt={`${l.title} cover photo`}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                            Listing preview
                          </div>
                        )}

                        <div className="absolute left-3 top-3 inline-flex items-center rounded-full border border-slate-700 bg-black/40 px-2.5 py-1 text-[10px] font-semibold text-slate-100 backdrop-blur">
                          {price ? `${price}/mo` : 'Price not listed'}
                        </div>
                      </div>

                      <div className="p-4">
                        <p className="text-sm font-semibold text-slate-50">{l.title}</p>
                        <p className="mt-1 text-[12px] text-slate-300">{loc || 'Location not specified'}</p>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-2">
                            <p className="text-slate-500">Beds / Baths</p>
                            <p className="mt-0.5 text-slate-100 font-semibold">
                              {(l.beds ?? '-') + ' / ' + (l.baths ?? '-')}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-2">
                            <p className="text-slate-500">Available</p>
                            <p className="mt-0.5 text-slate-100 font-semibold">{available}</p>
                          </div>
                        </div>

                        <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-2">
                          <p className="text-[11px] text-slate-500">Area / Address</p>
                          <p className="mt-0.5 text-[12px] text-slate-200">{addressLine || 'Not provided'}</p>
                          {l.hide_exact_address && (
                            <p className="mt-1 text-[11px] text-slate-500">
                              Exact address hidden until a showing is scheduled.
                            </p>
                          )}
                        </div>

                        <div className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold text-emerald-200">
                          View listing <span className="text-emerald-300">→</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <p className="mt-3 text-[10px] text-slate-500">
                Note: Listings shown here are published by individual landlords. RentZentro is software for managing rentals —
                not a property management company.
              </p>
            </>
          )}
        </section>

        {/* December promo explanation */}
        <section className="mb-8 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-5">
          <div className="max-w-2xl">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">
              December free access
            </h2>
            <p className="text-sm font-semibold text-slate-50">
              Start the new year organized — December is on us.
            </p>
            <p className="mt-2 text-[11px] text-slate-300">
              Create a new landlord account now and use RentZentro free through December 31st. No credit card required to start.
              On January 1st, you can add your card to keep your account active at{' '}
              <span className="font-semibold text-emerald-200">$29.95/month</span> or simply walk away.
            </p>

            <div className="mt-3 grid gap-3 text-[11px] sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="mb-1 text-[11px] font-semibold text-slate-100">Try it with real tenants</p>
                <p className="text-slate-400">Add properties, invite tenants, and run real rent reminders during the free period.</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="mb-1 text-[11px] font-semibold text-slate-100">No card, no surprise billing</p>
                <p className="text-slate-400">We won&apos;t charge you in December. You choose whether to continue in January.</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="mb-1 text-[11px] font-semibold text-slate-100">Keep what you set up</p>
                <p className="text-slate-400">If you subscribe, your tenants, payments, listings, and history stay in place.</p>
              </div>
            </div>

            <p className="mt-3 text-[10px] text-slate-500">
              Free access applies to new landlord accounts created now through January 1st. A payment method is required to continue service after the free period ends.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="mb-8 border-t border-slate-900 pt-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            How RentZentro fits into your day
          </h2>
          <div className="grid gap-4 text-sm md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="mb-1 text-xs font-semibold text-slate-200">1. Create your landlord account</p>
              <p className="text-[11px] text-slate-400">
                Sign up, add your properties and tenants, and turn on online payments, auto-pay, listings, and reminders.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="mb-1 text-xs font-semibold text-slate-200">2. Invite tenants & go live</p>
              <p className="text-[11px] text-slate-400">
                Tenants get a clean portal to pay rent, view documents, e-sign leases, and submit maintenance requests.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="mb-1 text-xs font-semibold text-slate-200">3. Stay organized in one dashboard</p>
              <p className="text-[11px] text-slate-400">
                Check what&apos;s overdue, what&apos;s paid, what needs fixing, and which documents need signatures—fast.
              </p>
            </div>
          </div>
        </section>
        {/* IMPORTANT: Footer removed — now handled globally in app/layout.tsx */}
      </div>
    </main>
  );
}
