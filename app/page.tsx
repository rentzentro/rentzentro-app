// app/page.tsx
import Link from 'next/link';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from './supabaseClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'RentZentro | Collect rent, track expenses, and manage rentals',
  description:
    'RentZentro is software for landlords. Collect rent online, enable auto-pay, send reminders, track expenses by property, view profit, manage maintenance, share documents, publish listings, and handle e-signatures in one simple platform.',
  alternates: {
    canonical: 'https://www.rentzentro.com/',
  },
  openGraph: {
    title: 'RentZentro | Collect rent online and see your real profit',
    description:
      'Collect rent online, track expenses by property, and manage rentals in one clean platform built for landlords.',
    url: 'https://www.rentzentro.com/',
    siteName: 'RentZentro',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RentZentro | Collect rent online and see your real profit',
    description:
      'Collect rent online, track expenses by property, and manage rentals in one place.',
  },
};

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

const testimonials: Testimonial[] = [
  {
    quote:
      'Clean dashboard, easy tenant setup, and way less back-and-forth than collecting rent manually every month.',
    name: 'David Marsh',
    role: 'Independent landlord',
    meta: 'Landlord feedback',
    image:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
  },
  {
    quote:
      'The tenant side feels simple, which matters. If tenants can use it without confusion, everything gets easier.',
    name: 'Steven Cole',
    role: 'Self-managing owner',
    meta: 'Landlord feedback',
    image:
      'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=300&q=80',
  },
  {
    quote:
      'What stood out to me was having payments, maintenance, documents, and expenses in one place instead of using multiple tools.',
    name: 'James Porter',
    role: 'Small portfolio landlord',
    meta: 'Landlord feedback',
    image:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
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
  if (!isSupabaseBrowserConfigured()) {
    return { listings: [] as Listing[], coverMap: new Map<number, PhotoRow>() };
  }

  const supabase = getSupabaseBrowserClient();
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
    <div className="group overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 transition duration-300 hover:-translate-y-1 hover:border-emerald-500/30 hover:bg-slate-900/70">
      <div className="relative h-44 w-full overflow-hidden bg-slate-950/50 sm:h-48">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={d.image}
          alt="Example rental listing preview"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          loading="lazy"
        />
        <div className="absolute left-3 top-3 inline-flex items-center rounded-full border border-slate-700 bg-black/50 px-2.5 py-1 text-[10px] font-semibold text-slate-100 backdrop-blur">
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
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-2.5">
            <p className="text-slate-500">Beds / Baths</p>
            <p className="mt-0.5 font-semibold text-slate-100">{d.bedsBaths}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-2.5">
            <p className="text-slate-500">Available</p>
            <p className="mt-0.5 font-semibold text-slate-100">{d.available}</p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-2.5">
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
      className="group overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 transition duration-300 hover:-translate-y-1 hover:border-emerald-500/30 hover:bg-slate-900/70"
    >
      <div className="relative h-44 w-full overflow-hidden bg-slate-950/50 sm:h-48">
        {cover?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.image_url}
            alt={`${listing.title} cover photo`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
            Listing preview
          </div>
        )}

        <div className="absolute left-3 top-3 inline-flex items-center rounded-full border border-slate-700 bg-black/50 px-2.5 py-1 text-[10px] font-semibold text-slate-100 backdrop-blur">
          {price ? `${price}/mo` : 'Price not listed'}
        </div>
      </div>

      <div className="p-4">
        <p className="text-sm font-semibold text-slate-50">{listing.title}</p>
        <p className="mt-1 text-[12px] text-slate-300">{loc || 'Location not specified'}</p>

        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-2.5">
            <p className="text-slate-500">Beds / Baths</p>
            <p className="mt-0.5 font-semibold text-slate-100">
              {(listing.beds ?? '-') + ' / ' + (listing.baths ?? '-')}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-2.5">
            <p className="text-slate-500">Available</p>
            <p className="mt-0.5 font-semibold text-slate-100">{available}</p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-2.5">
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
    <div className={`rounded-2xl border p-4 transition duration-300 hover:-translate-y-1 ${classes}`}>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold sm:text-2xl ${
          tone === 'success' ? 'text-emerald-300' : 'text-slate-50'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function TrustCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition duration-300 hover:-translate-y-1 hover:border-emerald-500/20 hover:bg-slate-900/70">
      <p className="text-sm font-semibold text-slate-50">{title}</p>
      <p className="mt-2 text-[13px] leading-6 text-slate-400">{text}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5 transition duration-300 hover:-translate-y-1 hover:border-emerald-500/20 hover:bg-slate-900/70">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-semibold text-emerald-300">
        {number}
      </div>
      <p className="text-sm font-semibold text-slate-50">{title}</p>
      <p className="mt-2 text-[13px] leading-6 text-slate-400">{text}</p>
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
    <div className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 p-5 transition duration-300 hover:-translate-y-1 hover:border-emerald-500/30 hover:bg-slate-900/70">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
      <div className="mb-4 flex items-center justify-between gap-3">
        <Stars />
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-200">
          {item.meta}
        </span>
      </div>

      <p className="min-h-[96px] text-[15px] leading-7 text-slate-200 sm:min-h-[108px]">
        “{item.quote}”
      </p>

      <div className="mt-5 flex items-center gap-3">
        <div className="h-11 w-11 overflow-hidden rounded-full border border-emerald-500/30 bg-slate-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.image}
            alt={`${item.name} testimonial photo`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
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
      'RentZentro is software for landlords. Collect rent online, track expenses by property, view property profit, manage tenants, maintenance, documents, listings, and e-signatures in one place.',
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

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes rzFadeUp {
              from {
                opacity: 0;
                transform: translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }

            .rz-fade-up {
              opacity: 0;
              animation: rzFadeUp 0.7s ease-out forwards;
            }

            .rz-delay-1 { animation-delay: 0.08s; }
            .rz-delay-2 { animation-delay: 0.16s; }
            .rz-delay-3 { animation-delay: 0.24s; }
            .rz-delay-4 { animation-delay: 0.32s; }
            .rz-delay-5 { animation-delay: 0.40s; }
            .rz-delay-6 { animation-delay: 0.48s; }
            .rz-delay-7 { animation-delay: 0.56s; }
            .rz-delay-8 { animation-delay: 0.64s; }
          `,
        }}
      />

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-4 sm:px-5 sm:py-6 lg:px-6">
        <div className="rz-fade-up mb-4 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-slate-900 px-3 py-2.5 text-center text-[11px] font-medium leading-5 text-emerald-100 shadow-sm sm:rounded-full sm:px-4">
          🎉 Start free for <span className="font-semibold text-emerald-300">35 days</span>. No
          card required. Then $29.95/month.
        </div>

        <header className="rz-fade-up rz-delay-1 mb-8 flex flex-col gap-3 sm:mb-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30 transition duration-300 hover:scale-105">
              <span className="text-lg font-semibold text-emerald-400">RZ</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">RentZentro</p>
              <p className="text-[11px] text-slate-400">
                Software for landlords — not a property management company
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Link
              href="/login"
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-center text-xs font-medium text-slate-100 transition duration-200 hover:scale-[1.02] hover:bg-slate-800 active:scale-95"
            >
              Log in
            </Link>
          </div>
        </header>

        <section className="grid gap-8 pb-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="rz-fade-up rz-delay-2 order-1">
            <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl lg:text-6xl">
              Collect Rent Online
              <br className="hidden sm:block" /> and See Your Real Profit
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              RentZentro gives landlords one simple place to collect rent, track expenses, manage
              tenants, and understand what each property is actually making.
            </p>

            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
              <Link
                href="/landlord/signup"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-sm transition duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-95"
              >
                Create Free Account
              </Link>
              <Link
                href="/listings"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-semibold text-slate-100 transition duration-200 hover:scale-[1.02] hover:bg-slate-800 active:scale-95"
              >
                Browse rentals
              </Link>
              <Link
                href="#demo"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-slate-800 bg-slate-950 px-6 py-3 text-sm font-semibold text-slate-200 transition duration-200 hover:scale-[1.02] hover:border-emerald-500/60 hover:text-emerald-200 active:scale-95"
              >
                Watch 2-Minute Demo
              </Link>
            </div>

            <p className="mt-3 text-[12px] leading-5 text-emerald-300">
              Join landlords across the U.S. already using RentZentro
            </p>

            <p className="mt-2 text-[12px] leading-5 text-slate-400">
              No card required • Setup in minutes • Funds go directly to your Stripe-connected
              account
            </p>

            <div className="mt-5 grid max-w-xl gap-2.5 text-sm text-slate-200">
              <div className="flex items-start gap-2">
                <span className="mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] text-emerald-300">
                  ✓
                </span>
                <p>Collect rent online with ACH and card payments</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] text-emerald-300">
                  ✓
                </span>
                <p>Track expenses by property and see real profit</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] text-emerald-300">
                  ✓
                </span>
                <p>Manage tenants, maintenance, documents, listings, and e-signatures</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] text-emerald-300">
                  ✓
                </span>
                <p>Order tenant screening through our TransUnion-powered partner flow</p>
              </div>
            </div>

            <div className="mt-5 inline-flex w-fit items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400/40 bg-slate-950/70 text-[9px] font-bold leading-tight text-emerald-300">
                TU
              </span>
              <p className="leading-5">Tenant screening uses a trusted TransUnion-backed screening provider.</p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1.5 transition duration-300 hover:border-emerald-500/30 hover:text-slate-300">
                35-day free trial
              </span>
              <span className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1.5 transition duration-300 hover:border-emerald-500/30 hover:text-slate-300">
                $29.95/mo flat pricing
              </span>
              <span className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1.5 transition duration-300 hover:border-emerald-500/30 hover:text-slate-300">
                Unlimited units
              </span>
              <span className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1.5 transition duration-300 hover:border-emerald-500/30 hover:text-slate-300">
                Secure payments via Stripe
              </span>
            </div>
          </div>

          <div className="rz-fade-up rz-delay-3 order-2 rounded-3xl border border-slate-800 bg-slate-950/70 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.65)] transition duration-300 hover:-translate-y-1 hover:border-emerald-500/20 sm:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Sample landlord view
                </p>
                <p className="text-sm font-semibold text-slate-50">
                  A cleaner way to see rent, expenses, and property performance
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Built for landlords
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Properties" value="12" />
              <StatCard label="Active tenants" value="11" />
              <StatCard label="Monthly rent roll" value="$14,750" tone="success" />
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 transition duration-300 hover:border-emerald-500/20">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-100">Financial snapshot</p>
                <span className="text-[10px] text-slate-500">This month</span>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 transition duration-300 hover:-translate-y-0.5">
                  <p className="text-xs font-semibold text-slate-100">Income</p>
                  <p className="mt-1 text-xs text-slate-200">$10,100 collected</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Live payment view</p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 transition duration-300 hover:-translate-y-0.5">
                  <p className="text-xs font-semibold text-slate-100">Expenses</p>
                  <p className="mt-1 text-xs text-slate-200">$2,240 logged</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Tracked by property</p>
                </div>

                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-3 transition duration-300 hover:-translate-y-0.5">
                  <p className="text-xs font-semibold text-emerald-100">Net profit</p>
                  <p className="mt-1 text-xs text-emerald-100/90">$7,860</p>
                  <p className="mt-0.5 text-[10px] text-emerald-100/80">
                    Real performance view
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 transition duration-300 hover:border-emerald-500/20">
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
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2.5 transition duration-300 hover:border-emerald-500/20 hover:bg-slate-900/70"
                    >
                      <div className="min-w-0 pr-3">
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

              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 transition duration-300 hover:border-emerald-500/20">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-100">Rent status</p>
                  <span className="text-[10px] text-slate-500">This month</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-950/30 px-3 py-2.5 transition duration-300 hover:-translate-y-0.5">
                    <span className="text-[11px] text-rose-100">Overdue</span>
                    <span className="text-[11px] font-semibold text-rose-200">1 unit</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2.5 transition duration-300 hover:-translate-y-0.5">
                    <span className="text-[11px] text-amber-100">Due soon</span>
                    <span className="text-[11px] font-semibold text-amber-200">3 units</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3 py-2.5 transition duration-300 hover:-translate-y-0.5">
                    <span className="text-[11px] text-emerald-100">Paid</span>
                    <span className="text-[11px] font-semibold text-emerald-200">8 units</span>
                  </div>
                </div>

                <p className="mt-3 text-[10px] leading-5 text-slate-500">
                  See collected rent, logged expenses, and payment status in one place instead of
                  bouncing between tools.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rz-fade-up rz-delay-4 border-t border-slate-900 py-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <TrustCard
              title="Secure payments"
              text="ACH and card payments are processed through Stripe with bank-level security."
            />
            <TrustCard
              title="Funds go directly to you"
              text="Rent goes directly to your connected account. RentZentro does not hold landlord funds."
            />
            <TrustCard
              title="Built for real landlords"
              text="Simple enough for smaller portfolios and strong enough to run your rental business cleanly."
            />
            <TrustCard
              title="Low-friction start"
              text="Start free for 35 days with no card required and get set up in minutes."
            />
            <TrustCard
              title="Trusted screening partner"
              text="Tenant screening is handled via our external partner flow that leverages TransUnion data."
            />
          </div>
        </section>

        <section id="demo" className="rz-fade-up rz-delay-5 border-t border-slate-900 py-10">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Product walkthrough
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-50">
                See how RentZentro works in under 2 minutes
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Real walkthrough of the landlord dashboard, payments, expenses, and maintenance
                flow.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.65)] transition duration-300 hover:-translate-y-1 hover:border-emerald-500/20 sm:p-4">
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-800 bg-black">
              <iframe
                src="https://www.loom.com/embed/092d99c74b704644b8ae91fd76b5b60b"
                frameBorder="0"
                allowFullScreen
                className="h-full w-full"
                title="RentZentro product demo"
              />
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] leading-5 text-slate-400">
                Watch the actual product flow before creating your account.
              </p>
              <span className="inline-flex w-fit items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-300">
                2-minute demo
              </span>
            </div>
          </div>
        </section>

        <section className="rz-fade-up rz-delay-6 border-t border-slate-900 py-10">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Why landlords switch
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-50">
              One system instead of scattered tools
            </h2>
            <p className="mt-2 max-w-3xl text-[14px] leading-6 text-slate-400">
              Most landlords piece together spreadsheets, payment apps, notes, and texts just to
              keep up. RentZentro brings rent collection, expenses, tenants, maintenance,
              documents, listings, and e-signatures into one clean platform.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5 transition duration-300 hover:-translate-y-1 hover:border-emerald-500/20 hover:bg-slate-900/70">
              <p className="text-sm font-semibold text-slate-50">
                What you can do inside RentZentro
              </p>
              <div className="mt-4 space-y-3 text-[13px] text-slate-300">
                {[
                  'Collect rent online with ACH and card payments through Stripe.',
                  'Send reminders and reduce late rent without manual follow-up.',
                  'Track payment status, tenants, maintenance, and documents in one place.',
                  'Log expenses by property and keep a simple monthly financial picture.',
                  'View income, expenses, and net profit together.',
                  'Publish listings and share rental links publicly.',
                  'Send leases and related documents for e-sign.',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <span className="mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] text-emerald-300">
                      ✓
                    </span>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-slate-950 to-slate-950 p-5 transition duration-300 hover:-translate-y-1 hover:border-emerald-500/30">
              <p className="text-sm font-semibold text-slate-50">The biggest difference</p>
              <h3 className="mt-2 text-2xl font-semibold text-emerald-300">
                Know what each property is actually making
              </h3>
              <p className="mt-3 text-[14px] leading-6 text-slate-300">
                It’s easy to know what rent is coming in. The harder part is knowing what’s left
                after expenses. RentZentro shows income and expenses together so you can understand
                real performance by property.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Income</p>
                  <p className="mt-1 text-lg font-semibold text-slate-50">Tracked</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Expenses</p>
                  <p className="mt-1 text-lg font-semibold text-slate-50">Logged by property</p>
                </div>
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-emerald-200/80">Net</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-200">
                    Visible instantly
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rz-fade-up rz-delay-7 border-t border-slate-900 py-10">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              How it works
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-50">
              Get started in minutes, not hours
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <StepCard
              number="1"
              title="Create your landlord account"
              text="Start your free 35-day trial, add your first property, and get organized fast."
            />
            <StepCard
              number="2"
              title="Invite tenants and collect rent"
              text="Tenants can pay by ACH or card while you keep payments, reminders, and account activity in one place."
            />
            <StepCard
              number="3"
              title="Track expenses and performance"
              text="Log costs, review income, and see what each property is actually making every month."
            />
          </div>
        </section>

        <section className="rz-fade-up rz-delay-8 border-t border-slate-900 py-10">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Landlord feedback
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-50">
                Built to feel simple, not bloated
              </h2>
              <p className="mt-2 max-w-2xl text-[13px] leading-6 text-slate-400">
                A cleaner, modern experience for landlords who want real visibility without
                enterprise-level complexity.
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

        <section className="rz-fade-up rz-delay-8 border-t border-slate-900 py-10">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Public listings
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-50">Browse rentals</h2>
              <p className="mt-2 text-[13px] leading-6 text-slate-400">
                RentZentro landlords can publish listings with photos and share them publicly by
                link.
              </p>
            </div>

            <Link
              href="/listings"
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 transition duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-95 md:w-auto"
            >
              Browse all listings
            </Link>
          </div>

          {publicListings.length === 0 ? (
            <>
              <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 transition duration-300 hover:border-emerald-500/20 hover:bg-slate-900/70">
                <p className="text-sm font-semibold text-slate-100">Listing preview</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-400">
                  Here’s what RentZentro listings look like. Real published listings will show here
                  automatically.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {demoCards.map((d) => (
                  <DemoListingCard key={d.title} d={d} />
                ))}
              </div>

              <p className="mt-3 text-[10px] leading-5 text-slate-500">
                Example listings above are demos for presentation. RentZentro is software for
                managing rentals — not a property management company.
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

        <section className="rz-fade-up rz-delay-8 border-t border-slate-900 py-10">
          <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-slate-950 p-5 transition duration-300 hover:border-emerald-500/40 hover:shadow-[0_18px_45px_rgba(0,0,0,0.4)] sm:p-6">
            <h2 className="text-2xl font-semibold text-slate-50">
              Start managing your rentals the right way
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Create your free account, set up your first property in minutes, and start tracking
              rent, expenses, and real performance from one place.
            </p>

            <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
              <Link
                href="/landlord/signup"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-95"
              >
                Create Free Account
              </Link>
              <Link
                href="/listings"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-semibold text-slate-100 transition duration-200 hover:scale-[1.02] hover:bg-slate-800 active:scale-95"
              >
                Browse rentals
              </Link>
              <Link
                href="/login"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-slate-800 bg-slate-950 px-6 py-3 text-sm font-semibold text-slate-200 transition duration-200 hover:scale-[1.02] hover:border-emerald-500/60 hover:text-emerald-200 active:scale-95"
              >
                Log in
              </Link>
            </div>

            <p className="mt-3 text-[12px] leading-5 text-slate-400">
              35-day free trial • No credit card required • Secure payments via Stripe • Built for
              landlords across the U.S.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
