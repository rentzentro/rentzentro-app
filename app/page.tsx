// app/page.tsx
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'RentZentro | Collect rent, track expenses, and manage rentals',
  description:
    'RentZentro is software for landlords. Collect rent online (ACH + card), enable auto-pay, send reminders, track tenants, log expenses, view profit, manage maintenance, share documents, publish listings, and handle e-signatures in one simple platform.',
  alternates: {
    canonical: 'https://www.rentzentro.com/',
  },
  openGraph: {
    title: 'RentZentro | Stop chasing rent. Track rent, expenses, and profit.',
    description:
      'Collect rent online, track expenses, view property profit, manage tenants, maintenance, listings, and documents in one clean landlord platform.',
    url: 'https://www.rentzentro.com/',
    siteName: 'RentZentro',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RentZentro | Stop chasing rent. Track rent, expenses, and profit.',
    description:
      'Collect rent online, track expenses, manage tenants, maintenance, listings, and documents in one place.',
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

type DemoCard = {
  title: string;
  loc: string;
  price: string;
  bedsBaths: string;
  available: string;
  area: string;
  image: string;
};

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  meta: string;
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

const testimonials: Testimonial[] = [
  {
    quote:
      'Clean dashboard, easy tenant setup, and way less back-and-forth than collecting rent manually every month.',
    name: 'David Marsh',
    role: 'Independent landlord',
    meta: 'Verified landlord',
  },
  {
    quote:
      'The tenant side feels simple, which matters. If tenants can use it without confusion, everything gets easier.',
    name: 'Sarah Cole',
    role: 'Self-managing owner',
    meta: 'Verified landlord',
  },
  {
    quote:
      'What stood out to me was having payments, maintenance, documents, and now expenses in one place instead of using multiple tools.',
    name: 'James Porter',
    role: 'Small portfolio landlord',
    meta: 'Verified landlord',
  },
];

const money = (v: number | null | undefined) =>
  v == null || isNaN(v) ? null : `$${v.toLocaleString('en-US')}`;

const fmtDate = (value: string | null | undefined) => {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

async function getHomepageListings(limit = 6) {
  const { data: listings, error } = await supabase
    .from('listings')
    .select(`
      id, title, slug, published, published_at,
      city, state, neighborhood,
      rent_amount, beds, baths, available_date,
      hide_exact_address, address_line1, address_line2, postal_code
    `)
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const ids = (listings || []).map((l: any) => l.id).filter(Boolean);
  if (ids.length === 0) {
    return {
      listings: (listings || []) as Listing[],
      coverMap: new Map<number, PhotoRow>(),
    };
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
            <p className="mt-0.5 font-semibold text-slate-100">{d.bedsBaths}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-2">
            <p className="text-slate-500">Available</p>
            <p className="mt-0.5 font-semibold text-slate-100">{d.available}</p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-2">
          <p className="text-[11px] text-slate-500">Area</p>
          <p className="mt-0.5 text-[12px] text-slate-200">{d.area}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Exact address hidden until a showing is scheduled.
          </p>
        </div>
      </div>
    </div>
  );
}

function LiveListingCard({
  listing,
  cover,
}: {
  listing: Listing;
  cover?: PhotoRow;
}) {
  const loc = [listing.neighborhood, listing.city, listing.state]
    .filter(Boolean)
    .join(', ');
  const price = money(listing.rent_amount);
  const available = fmtDate(listing.available_date) || 'Now';

  const addressLine = listing.hide_exact_address
    ? [listing.neighborhood, listing.city, listing.state].filter(Boolean).join(', ')
    : [
        listing.address_line1,
        listing.address_line2,
        listing.city,
        listing.state,
        listing.postal_code,
      ]
        .filter(Boolean)
        .join(', ');

  return (
    <Link
      href={`/listings/${listing.slug}`}
      className="group overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 transition-colors hover:bg-slate-900/55"
    >
      <div className="relative h-44 w-full overflow-hidden bg-slate-950/50">
        {cover?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.image_url}
            alt={`${listing.title} cover photo`}
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
        <p className="text-sm font-semibold text-slate-50">{listing.title}</p>
        <p className="mt-1 text-[12px] text-slate-300">{loc || 'Location not specified'}</p>

        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-2">
            <p className="text-slate-500">Beds / Baths</p>
            <p className="mt-0.5 font-semibold text-slate-100">
              {(listing.beds ?? '-') + ' / ' + (listing.baths ?? '-')}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-2">
            <p className="text-slate-500">Available</p>
            <p className="mt-0.5 font-semibold text-slate-100">{available}</p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-2">
          <p className="text-[11px] text-slate-500">Area / Address</p>
          <p className="mt-0.5 text-[12px] text-slate-200">{addressLine || 'Not provided'}</p>
          {listing.hide_exact_address && (
            <p className="mt-1 text-[11px] text-slate-500">
              Exact address hidden until a showing is scheduled.
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success';
}) {
  const classes =
    tone === 'success'
      ? 'border-emerald-500/40 bg-emerald-950/30'
      : 'border-slate-800 bg-slate-900/80';

  return (
    <div className={`rounded-2xl border p-4 ${classes}`}>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          tone === 'success' ? 'text-emerald-300' : 'text-slate-50'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Stars() {
  return (
    <div className="flex items-center gap-1 text-amber-300" aria-label="5 star rating">
      <span>★</span>
      <span>★</span>
      <span>★</span>
      <span>★</span>
      <span>★</span>
    </div>
  );
}

function TestimonialCard({ item }: { item: Testimonial }) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 p-5 transition-colors hover:bg-slate-900/70">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
      <div className="mb-4 flex items-center justify-between gap-3">
        <Stars />
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-200">
          {item.meta}
        </span>
      </div>

      <p className="min-h-[108px] text-[15px] leading-7 text-slate-200">
        “{item.quote}”
      </p>

      <div className="mt-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15 text-sm font-semibold text-emerald-200">
          {item.name
            .split(' ')
            .map((word) => word[0])
            .join('')
            .slice(0, 2)}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-50">{item.name}</p>
          <p className="text-[12px] text-slate-400">{item.role}</p>
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
      'RentZentro is software for landlords. Collect rent online, track expenses, view property profit, manage tenants, maintenance, documents, listings, and e-signatures in one place.',
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 lg:px-6">
        <div className="mb-4 rounded-full border border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-slate-900 px-4 py-2 text-center text-[11px] font-medium text-emerald-100 shadow-sm">
          🎉 New landlord promo:{' '}
          <span className="font-semibold text-emerald-300">
            First month free — no card required to start.
          </span>{' '}
          $29.95/mo after the free period.
        </div>

        <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
              <span className="text-lg font-semibold text-emerald-400">RZ</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">RentZentro</p>
              <p className="text-[11px] text-slate-400">
                Simple rent collection and landlord management software
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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

        <section className="grid gap-8 pb-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Payments powered by Stripe
            </div>

            <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl lg:text-6xl">
              Stop chasing rent. Track rent, expenses, and profit in one place.
            </h1>

            <p className="mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">
              Collect rent online, enable auto-pay, send reminders, track tenants,
              log expenses, view property profit, manage maintenance, and keep
              everything organized in one simple platform built for landlords.
            </p>

            <div className="mt-5 grid max-w-xl gap-2 text-sm text-slate-200">
              <div className="flex items-start gap-2">
                <span className="mt-[2px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] text-emerald-300">
                  ✓
                </span>
                <p>ACH & card payments</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-[2px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] text-emerald-300">
                  ✓
                </span>
                <p>Auto-pay & automatic reminders</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-[2px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] text-emerald-300">
                  ✓
                </span>
                <p>Track expenses and see property performance</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-[2px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] text-emerald-300">
                  ✓
                </span>
                <p>Maintenance, documents, listings, and e-signatures in one dashboard</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/landlord/signup"
                className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400"
              >
                Start Free — No card required
              </Link>
              <Link
                href="/listings"
                className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-800"
              >
                Browse rentals
              </Link>
            </div>

            <p className="mt-3 text-[12px] text-emerald-300">
              Funds go directly to your Stripe-connected account. RentZentro never holds your money.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1">
                First month free
              </span>
              <span className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1">
                $29.95/mo flat pricing
              </span>
              <span className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1">
                Unlimited units
              </span>
              <span className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1">
                Expenses + profit tracking
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.65)]">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Live rent overview
                </p>
                <p className="text-sm font-semibold text-slate-50">
                  What landlords care about most
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Simple dashboard
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Properties" value="12" />
              <StatCard label="Active tenants" value="11" />
              <StatCard label="Monthly rent roll" value="$14,750" tone="success" />
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-100">Rent status</p>
                <span className="text-[10px] text-slate-500">This month</span>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 p-3">
                  <p className="text-xs font-semibold text-rose-100">Overdue</p>
                  <p className="mt-1 text-xs text-rose-100/90">1 unit · $1,200</p>
                  <p className="mt-0.5 text-[10px] text-rose-200/80">14 Maple · 2B</p>
                </div>

                <div className="rounded-2xl border border-amber-500/40 bg-amber-950/40 p-3">
                  <p className="text-xs font-semibold text-amber-100">Due soon</p>
                  <p className="mt-1 text-xs text-amber-100/90">3 units · $3,450</p>
                  <p className="mt-0.5 text-[10px] text-amber-100/80">Auto-reminders enabled</p>
                </div>

                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-3">
                  <p className="text-xs font-semibold text-emerald-100">Paid</p>
                  <p className="mt-1 text-xs text-emerald-100/90">8 units · $10,100</p>
                  <p className="mt-0.5 text-[10px] text-emerald-100/80">Logged via Stripe</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-100">Recent payments</p>
                  <span className="text-[10px] text-slate-500">Last 3</span>
                </div>

                <div className="space-y-2">
                  {[
                    {
                      name: 'J. Smith · 10 Oak · 1A',
                      amount: '$1,050',
                      meta: 'Card • Today · 9:14 AM',
                    },
                    {
                      name: 'L. Rivera · 22 Pine · 3C',
                      amount: '$1,250',
                      meta: 'ACH • Yesterday · 4:27 PM',
                    },
                    {
                      name: 'D. Chen · 7 Spruce · 2F',
                      amount: '$975',
                      meta: 'Card • 2 days ago',
                    },
                  ].map((p) => (
                    <div
                      key={p.name}
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-medium text-slate-100">
                          {p.name}
                        </p>
                        <p className="text-[10px] text-slate-500">{p.meta}</p>
                      </div>
                      <p className="shrink-0 text-[11px] font-semibold text-emerald-300">
                        {p.amount}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-100">Financial snapshot</p>
                  <span className="text-[10px] text-slate-500">This month</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                    <span className="text-[11px] text-slate-300">Income</span>
                    <span className="text-[11px] font-semibold text-emerald-300">$10,100</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                    <span className="text-[11px] text-slate-300">Expenses</span>
                    <span className="text-[11px] font-semibold text-rose-300">$2,240</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3 py-2">
                    <span className="text-[11px] text-emerald-100">Net profit</span>
                    <span className="text-[11px] font-semibold text-emerald-200">$7,860</span>
                  </div>
                </div>

                <p className="mt-3 text-[10px] text-slate-500">
                  See rent collected, expenses logged, and simple property performance in one dashboard.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-900 py-10">
          <div className="mb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Product walkthrough
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-50">
              See how RentZentro works
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-300">
              Quick walkthrough of the landlord dashboard, tenants, payments, expenses, and maintenance flow.
            </p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.65)] sm:p-4">
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-800 bg-black">
              <iframe
                src="https://www.loom.com/embed/79090a64a76b4d60ab01286b95b48d90"
                frameBorder="0"
                allowFullScreen
                className="h-full w-full"
                title="RentZentro product demo"
              />
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] text-slate-400">
                Watch the product demo without leaving RentZentro.
              </p>
              <span className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950">
                Demo embedded on page
              </span>
            </div>

            <p className="mt-3 text-center text-[11px] text-slate-500">
              No spreadsheets. No chasing tenants. No jumping between tools.
            </p>
          </div>
        </section>

        <section className="grid gap-4 border-t border-slate-900 py-10 lg:grid-cols-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
            <p className="text-sm font-semibold text-slate-50">Built for landlords</p>
            <p className="mt-2 text-[13px] text-slate-400">
              RentZentro is software for landlords — not a property management company.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
            <p className="text-sm font-semibold text-slate-50">Powered by Stripe</p>
            <p className="mt-2 text-[13px] text-slate-400">
              Secure ACH and card payments with funds sent directly to your connected account.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
            <p className="text-sm font-semibold text-slate-50">Simple pricing</p>
            <p className="mt-2 text-[13px] text-slate-400">
              $29.95/month flat pricing with unlimited units, tenants, payments, maintenance, and expenses.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
            <p className="text-sm font-semibold text-slate-50">Financial clarity</p>
            <p className="mt-2 text-[13px] text-slate-400">
              Log expenses, view property totals, and keep a simple picture of income, expenses, and net.
            </p>
          </div>
        </section>

        <section className="border-t border-slate-900 py-10">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Landlord feedback
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-50">
                A cleaner way to manage rent
              </h2>
              <p className="mt-2 max-w-2xl text-[13px] text-slate-400">
                Designed to build trust fast with a more polished, modern experience for landlords and tenants.
              </p>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-200">
              <span className="text-amber-300">★★★★★</span>
              Better first impressions matter
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {testimonials.map((item) => (
              <TestimonialCard key={item.quote} item={item} />
            ))}
          </div>
        </section>

        <section className="border-t border-slate-900 py-10">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              How it works
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-50">
              Set up in minutes, not hours
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-semibold text-emerald-300">
                1
              </div>
              <p className="text-sm font-semibold text-slate-50">Add your property and tenant</p>
              <p className="mt-2 text-[13px] text-slate-400">
                Create your first property, invite a tenant, and keep everything organized from day one.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-semibold text-emerald-300">
                2
              </div>
              <p className="text-sm font-semibold text-slate-50">Collect rent and log expenses</p>
              <p className="mt-2 text-[13px] text-slate-400">
                Tenants can pay by ACH or card, while landlords can keep expenses tied to each property.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-semibold text-emerald-300">
                3
              </div>
              <p className="text-sm font-semibold text-slate-50">Track everything in one place</p>
              <p className="mt-2 text-[13px] text-slate-400">
                Payments, expenses, tenants, documents, maintenance, listings, and e-signatures stay in one clean dashboard.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-900 py-10">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              What you get
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-50">
              The core tools landlords actually use
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
              <p className="text-sm font-semibold text-slate-50">For landlords</p>
              <div className="mt-4 space-y-3 text-[13px] text-slate-300">
                {[
                  'Collect rent online with ACH and card payments through Stripe.',
                  'Enable auto-pay and automatic reminders to reduce late rent.',
                  'Track payment status, documents, tenants, and maintenance in one place.',
                  'Log expenses by property and keep a simple monthly financial picture.',
                  'View income, expenses, and net profit without bouncing between multiple tools.',
                  'Publish listings, share rental links, and send leases for e-sign.',
                  'Add team members to help manage rent, maintenance, listings, and messaging.',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <span className="mt-[2px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] text-emerald-300">
                      ✓
                    </span>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
              <p className="text-sm font-semibold text-slate-50">For tenants</p>
              <div className="mt-4 space-y-3 text-[13px] text-slate-300">
                {[
                  'Pay rent online with card or bank transfer (ACH).',
                  'Set up auto-pay if enabled by the landlord.',
                  'Submit maintenance requests and track updates.',
                  'View shared documents and sign leases electronically.',
                  'Use secure in-app messaging instead of digging through old text threads.',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <span className="mt-[2px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] text-emerald-300">
                      ✓
                    </span>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-900 py-10">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Public listings
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-50">Browse rentals</h2>
              <p className="mt-2 text-[13px] text-slate-400">
                RentZentro landlords can publish listings with photos and share them by link.
              </p>
            </div>

            <Link
              href="/listings"
              className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Browse all listings
            </Link>
          </div>

          {publicListings.length === 0 ? (
            <>
              <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <p className="text-sm font-semibold text-slate-100">Listing preview</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Here’s what RentZentro listings look like. Real published listings will show here automatically.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {demoCards.map((d) => (
                  <DemoListingCard key={d.title} d={d} />
                ))}
              </div>

              <p className="mt-3 text-[10px] text-slate-500">
                Example listings above are demos for presentation. RentZentro is software for managing rentals — not a property management company.
              </p>
            </>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {publicListings.map((listing) => (
                <LiveListingCard
                  key={listing.id}
                  listing={listing}
                  cover={coverMap.get(listing.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="border-t border-slate-900 py-10">
          <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-slate-950 p-6">
            <h2 className="text-2xl font-semibold text-slate-50">
              Ready to stop chasing rent?
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Start free, set up your first property in minutes, and manage rent, expenses, and property performance from one place.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href="/landlord/signup"
                className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Start Free — No card required
              </Link>
              <Link
                href="/landlord/login"
                className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-800"
              >
                Landlord log in
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}