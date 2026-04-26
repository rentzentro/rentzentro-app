// app/page.tsx
import Link from 'next/link';
import BrandWordmark from './components/BrandWordmark';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from './supabaseClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'RentZentro | Built for landlords who want clear rental profit',
  description:
    'RentZentro is powerful rental operations software for landlords and teams managing portfolios of any size. Track profit by property, collect rent securely with Stripe, and run leasing, maintenance, and documents in one platform.',
  alternates: {
    canonical: 'https://www.rentzentro.com/',
  },
  openGraph: {
    title: 'RentZentro | Stop guessing your rental profit',
    description:
      'Powerful landlord software to see real rent, expenses, and profit across portfolios of any size.',
    url: 'https://www.rentzentro.com/',
    siteName: 'RentZentro',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RentZentro | Stop guessing your rental profit',
    description:
      'See real rent, expenses, and profit numbers in a powerful landlord platform built to scale.',
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

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  meta: string;
  image: string;
};

type PricingPlan = {
  name: string;
  price: string;
  unitRange: string;
  description: string;
  highlights: string[];
  featured?: boolean;
};

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

const pricingPlans: PricingPlan[] = [
  {
    name: 'Starter',
    price: '$19/mo',
    unitRange: 'Up to 3 units',
    description: 'Best for new landlords who want the essentials in one place.',
    highlights: [
      'Collect rent with ACH and card payments',
      'Track tenants, documents, and maintenance',
      'View income, expenses, and net profit',
    ],
  },
  {
    name: 'Core',
    price: '$29.95/mo',
    unitRange: 'Up to 20 units',
    description: 'Most popular for growing landlords managing multiple doors.',
    highlights: [
      'Everything in Starter',
      'More unit capacity for growing portfolios',
      'Clear property-by-property performance view',
    ],
    featured: true,
  },
  {
    name: 'Growth',
    price: '$59/mo',
    unitRange: 'Up to 75 units',
    description: 'For larger portfolios that need scale without adding complexity.',
    highlights: [
      'Everything in Core',
      'Built for higher monthly rent volume',
      'Manage more tenants with one workflow',
    ],
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
      className="group overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950 transition duration-300 hover:-translate-y-1 hover:border-emerald-500/20 hover:bg-slate-900/70"
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
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950 p-2.5">
            <p className="text-slate-500">Beds / Baths</p>
            <p className="mt-0.5 font-semibold text-slate-100">
              {(listing.beds ?? '-') + ' / ' + (listing.baths ?? '-')}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950 p-2.5">
            <p className="text-slate-500">Available</p>
            <p className="mt-0.5 font-semibold text-slate-100">{available}</p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950 p-2.5">
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

function TrustCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950 p-4 transition duration-300 hover:-translate-y-1 hover:border-emerald-500/20 hover:bg-slate-900/70">
      <p className="text-sm font-semibold text-slate-50">{title}</p>
      <p className="mt-2 text-[13px] leading-6 text-slate-400">{text}</p>
    </div>
  );
}


function NationwideCoverageMap() {
  return (
    <div className="relative w-full">
      <div className="overflow-hidden rounded-2xl border border-[rgba(59,130,246,0.15)] bg-slate-950/20 p-3 sm:p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/us-network-map.png"
          alt="United States coverage map with glowing network connections"
          className="mx-auto h-auto w-full max-w-3xl object-contain drop-shadow-[0_0_36px_rgba(59,130,246,0.48)]"
          loading="lazy"
        />
      </div>
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
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950 p-5 transition duration-300 hover:-translate-y-1 hover:border-emerald-500/20 hover:bg-slate-900/70">
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
    <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950 p-5 transition duration-300 hover:-translate-y-1 hover:border-emerald-500/20 hover:bg-slate-900/70">
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

function PricingCard({ plan }: { plan: PricingPlan }) {
  return (
    <div
      className={`rounded-3xl border p-5 transition duration-300 hover:-translate-y-1 ${
        plan.featured
          ? 'border-emerald-400/30 bg-emerald-950/25'
          : 'border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950 hover:border-emerald-500/20 hover:bg-slate-900/70'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold text-slate-50">{plan.name}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            {plan.unitRange}
          </p>
        </div>
        {plan.featured && (
          <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
            Most popular
          </span>
        )}
      </div>

      <p className="mt-4 text-3xl font-semibold text-emerald-300">{plan.price}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{plan.description}</p>

      <ul className="mt-4 space-y-2.5">
        {plan.highlights.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-slate-200">
            <span className="mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/14 text-[11px] text-emerald-300">
              ✓
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
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
      price: '19',
      priceCurrency: 'USD',
      url: 'https://www.rentzentro.com/landlord/signup',
    },
  };

  return (
    <main className="min-h-screen bg-[#020617] text-slate-50">
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

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-28 top-16 h-72 w-72 rounded-full bg-emerald-500/14 blur-3xl" />
        <div className="absolute right-[-8rem] top-44 h-80 w-80 rounded-full bg-emerald-500/7 blur-3xl" />
        <div className="absolute bottom-24 left-1/3 h-56 w-56 rounded-full bg-emerald-500/7 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-4 sm:px-5 sm:py-6 lg:px-6">
        <div className="rz-fade-up mb-4 rounded-2xl border border-emerald-300/40 bg-gradient-to-r from-emerald-400/20 via-emerald-300/5 to-slate-900/80 px-3 py-2.5 text-center text-[11px] font-medium leading-5 text-emerald-50 shadow-[0_0_35px_rgba(16,185,129,0.2)] backdrop-blur sm:rounded-full sm:px-4">
          🎉 Start free for <span className="font-semibold text-emerald-300">35 days</span>. No
          card required.
        </div>

        <header className="rz-fade-up rz-delay-1 mb-8 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 shadow-[0_12px_40px_rgba(2,6,23,0.55)] backdrop-blur-xl sm:mb-10 sm:flex-row sm:items-center sm:justify-between">
          <BrandWordmark
            subtitle="You stay in control. RentZentro is software — not a property manager."
            iconClassName="h-10 w-10 rounded-xl text-lg transition duration-300 hover:scale-105"
            titleClassName="text-sm"
          />

          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Link
              href="/login"
              className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-2 text-center text-xs font-medium text-slate-100 transition duration-200 hover:scale-[1.02] hover:border-emerald-400/40 hover:bg-white/5 active:scale-95"
            >
              Log in
            </Link>
          </div>
        </header>

        <section className="grid gap-8 pb-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="rz-fade-up rz-delay-2 order-1">
            <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight leading-[1.1] text-slate-50 sm:text-5xl lg:text-6xl">
              Run your entire rental business in one place
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
              Stop chasing rent, juggling spreadsheets, and guessing your numbers. RentZentro
              brings listings, tenants, payments, expenses, and maintenance into one clean system
              — so you actually know what your properties are making.
            </p>

            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
              <Link
                href="/landlord/signup"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 to-emerald-300 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_10px_30px_rgba(16,185,129,0.25)] transition duration-200 hover:scale-[1.02] hover:from-emerald-300 hover:to-emerald-200 active:scale-95"
              >
                Start Free - No Card Required
              </Link>
              <Link
                href="#demo"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-white/10 bg-slate-950/80 px-6 py-3 text-sm font-semibold text-slate-200 transition duration-200 hover:scale-[1.02] hover:border-emerald-400/40 hover:bg-white/5 active:scale-95"
              >
                Watch 2-Minute Demo
              </Link>
            </div>

            <p className="mt-3 text-[12px] leading-5 text-emerald-300">
              Rent goes directly to your connected account. You stay in control. RentZentro never
              holds your money.
            </p>

            <p className="mt-2 text-[12px] leading-5 text-slate-400">
              Crafted for landlords • No complicated setup • Works with your existing
              tenants
            </p>

            <div className="mt-5 grid max-w-xl gap-2.5 text-sm text-slate-200">
              <div className="flex items-start gap-2">
                <span className="mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/14 text-[11px] text-emerald-300">
                  ✓
                </span>
                <p>See exactly what each property is making</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/14 text-[11px] text-emerald-300">
                  ✓
                </span>
                <p>Know your real monthly profit instantly</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/14 text-[11px] text-emerald-300">
                  ✓
                </span>
                <p>Stop switching between tools</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/14 text-[11px] text-emerald-300">
                  ✓
                </span>
                <p>Use the location-based maintenance directory to find electricians, plumbers, and more</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/14 text-[11px] text-emerald-300">
                  ✓
                </span>
                <p>Order tenant screening through our TransUnion-powered partner flow</p>
              </div>
            </div>

            <div className="mt-5 inline-flex w-fit items-center gap-3 rounded-2xl border border-sky-300/40 bg-sky-500/15 px-3 py-2 text-[11px] text-sky-100">
              <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-sky-300/40 bg-sky-500/25">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 64 64"
                  className="h-7 w-7"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    cx="32"
                    cy="32"
                    r="24"
                    fill="none"
                    stroke="white"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray="118 35"
                    transform="rotate(30 32 32)"
                  />
                  <text
                    x="18"
                    y="42"
                    fill="white"
                    fontSize="28"
                    fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
                    fontStyle="italic"
                    fontWeight="700"
                  >
                    tu
                  </text>
                </svg>
              </span>
              <p className="leading-5">Tenant screening uses a trusted TransUnion-backed screening provider.</p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span className="rounded-full border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950 px-2.5 py-1.5 transition duration-300 hover:border-emerald-500/20 hover:text-slate-300">
                Free trial available
              </span>
              <span className="rounded-full border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950 px-2.5 py-1.5 transition duration-300 hover:border-emerald-500/20 hover:text-slate-300">
                Plans: $19 / $29.95 / $59
              </span>
              <span className="rounded-full border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950 px-2.5 py-1.5 transition duration-300 hover:border-emerald-500/20 hover:text-slate-300">
                Clear unit-based tiers
              </span>
              <span className="rounded-full border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950 px-2.5 py-1.5 transition duration-300 hover:border-emerald-500/20 hover:text-slate-300">
                Secure payments via Stripe
              </span>
            </div>
          </div>

          <div className="rz-fade-up rz-delay-3 order-2 rounded-3xl border border-[#17315f] bg-[#020b2f] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.6)] ring-1 ring-white/5 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/40 sm:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  Sample landlord view
                </p>
                <p className="text-sm font-semibold text-slate-100">
                  Dashboard preview styled like the live landlord product
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-1 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium text-cyan-200">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                Live look &amp; feel
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Monthly income', value: '$2,200.00', tone: 'text-emerald-300' },
                { label: 'Monthly expenses', value: '$425.00', tone: 'text-rose-300' },
                { label: 'Net profit', value: '$1,775.00', tone: 'text-emerald-300' },
                { label: 'Active portfolio', value: '1', tone: 'text-slate-100', sub: '1 active tenants' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-[#20406f] bg-[#03113f] px-4 py-3"
                >
                  <p className="text-[11px] text-slate-300">{stat.label}</p>
                  <p className={`mt-1 text-4xl font-medium leading-none ${stat.tone}`}>{stat.value}</p>
                  {stat.sub ? <p className="mt-1 text-[11px] text-slate-400">{stat.sub}</p> : null}
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-[1.45fr_1fr]">
              <div className="rounded-2xl border border-[#20406f] bg-[#03113f] p-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-300">Property performance</p>
                <div className="mt-3 rounded-xl border border-[#264574] bg-[#021038] p-3">
                  <div className="mb-2 flex items-center justify-between text-[13px] font-semibold text-slate-100">
                    <span>123 Main st · 2R</span>
                    <span className="text-emerald-300">$1,775.00</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-2 overflow-hidden rounded-full bg-cyan-950">
                      <div className="h-full w-full rounded-full bg-emerald-400" />
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-cyan-950">
                      <div className="h-full w-1/4 rounded-full bg-rose-300" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#20406f] bg-[#03113f] p-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-300">Cash flow ratio</p>
                <div className="mt-3 flex justify-center">
                  <div className="relative grid h-40 w-40 place-items-center rounded-full bg-[conic-gradient(#34d399_0_78%,#f87171_78%_100%)]">
                    <div className="grid h-24 w-24 place-items-center rounded-full bg-[#020b2f] text-center">
                      <p className="text-[10px] text-slate-300">$2,200.00</p>
                      <p className="text-[10px] text-slate-200">collected</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-[12px] text-slate-200">
                  <div className="flex items-center justify-between"><span>Income</span><span>$2,200.00</span></div>
                  <div className="flex items-center justify-between"><span>Expenses</span><span>$425.00</span></div>
                  <div className="flex items-center justify-between"><span>Rent roll</span><span>$2,200.00</span></div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#20406f] bg-[#03113f] p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-300">Rent status</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">Overdue, upcoming, and future rent</p>
                </div>
                <div className="hidden gap-2 md:flex">
                  <span className="rounded-full border border-[#32507a] bg-[#082352] px-3 py-1 text-[11px] text-slate-100">Manage properties</span>
                  <span className="rounded-full border border-[#32507a] bg-[#082352] px-3 py-1 text-[11px] text-slate-100">Manage tenants</span>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  { title: 'Overdue', count: '0', tone: 'border-rose-500/40 bg-rose-950/20 text-rose-100', note: 'No units overdue right now.' },
                  { title: 'Upcoming 7 days', count: '0', tone: 'border-amber-500/40 bg-amber-950/20 text-amber-100', note: 'No rent coming due in the next week.' },
                  { title: 'Not due yet', count: '1', tone: 'border-emerald-400/40 bg-emerald-950/20 text-emerald-100', note: '123 Main st · 2R · Due June 1, 2026 · $2,200.00' },
                ].map((item) => (
                  <div key={item.title} className={`rounded-xl border px-3 py-2.5 ${item.tone}`}>
                    <div
                      className="mb-2 flex items-center justify-between text-[12px] font-semibold"
                    >
                      <span>{item.title}</span>
                      <span>{item.count}</span>
                    </div>
                    <p className="text-[11px] leading-5 opacity-90">{item.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="demo" className="rz-fade-up rz-delay-5 border-t border-slate-900 py-14">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Product walkthrough
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-50">
                See how RentZentro works in under 2 minutes
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Real walkthrough of the landlord dashboard, payments, expenses, and maintenance
                flow.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.65)] transition duration-300 hover:-translate-y-1 hover:border-emerald-500/20 hover:bg-slate-900/70 sm:p-4">
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
              <iframe
                src="https://www.youtube.com/embed/DESoz0Q8Ors"
                frameBorder="0"
                allowFullScreen
                className="h-full w-full"
                title="RentZentro product demo"
              />
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] leading-5 text-slate-400">
                Watch the actual product flow - Start free.
              </p>
              <Link
                href="/landlord/signup"
                className="inline-flex min-h-[40px] w-fit items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 to-emerald-300 px-4 py-2 text-[11px] font-semibold text-slate-950 shadow-[0_10px_30px_rgba(16,185,129,0.25)] transition duration-200 hover:scale-[1.02] hover:from-emerald-300 hover:to-emerald-200 active:scale-95"
              >
                Start Free - No Card Required
              </Link>
            </div>
          </div>
        </section>


        <section className="rz-fade-up rz-delay-4 pb-14">
          <div className="grid w-full gap-8 rounded-[30px] border border-[rgba(59,130,246,0.15)] bg-gradient-to-br from-slate-900/90 to-slate-950 p-6 shadow-[0_24px_70px_rgba(2,8,30,0.7)] sm:p-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-10">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
                NATIONWIDE FOOTPRINT
              </p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-slate-50 sm:text-4xl">
                Built for landlords across the U.S.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-400/95 sm:text-lg">
                Whether you manage one rental or a growing portfolio, RentZentro helps you
                collect rent, track expenses, and keep your rental business organized in one
                place.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-300">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/45 bg-emerald-400/16 px-4 py-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-300/25 text-[12px] text-emerald-50">
                    ✓
                  </span>
                  Works in all 50 states
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/45 bg-emerald-400/16 px-4 py-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-300/25 text-[12px] text-emerald-50">
                    👥
                  </span>
                  Built for portfolios of any size
                </span>
              </div>
            </div>
            <div className="lg:pl-4">
              <NationwideCoverageMap />
            </div>
          </div>
        </section>

        <section className="rz-fade-up rz-delay-4 border-t border-slate-900 py-14">
          <div className="mb-8 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950 p-5 sm:p-6">
            <h2 className="text-2xl font-semibold text-slate-50">What most landlords deal with</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-400">
              {[
                'Tracking rent across apps, texts, and spreadsheets',
                'No clear view of profit per property',
                'Chasing tenants for payments',
                'Scattered maintenance, documents, and communication',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/14 text-[11px] text-emerald-300">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm font-semibold text-emerald-300">
              RentZentro replaces all of this with one simple system.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <TrustCard
              title="Payments powered by Stripe"
              text="ACH and card payments with bank-level security."
            />
            <TrustCard
              title="No platform holds funds"
              text="Rent goes directly to your connected account. You stay in control of your money at all times."
            />
            <TrustCard
              title="Built for independent landlords or property managers"
              text="Simple and clear for independent landlords. Strong enough for growing property managers."
            />
            <TrustCard
              title="No complicated setup"
              text="Start free for 35 days with no card required and get set up in minutes."
            />
            <TrustCard
              title="Works with your existing tenants"
              text="Invite current tenants and keep rent, maintenance, and documents in one simple place."
            />
          </div>
          <p className="mt-4 text-sm font-bold text-slate-100">
            You stay in control of your money at all times.
          </p>
        </section>

        <section className="rz-fade-up rz-delay-5 border-t border-slate-900 py-14">
          <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-slate-950 to-slate-950 p-5 transition duration-300 hover:-translate-y-1 hover:border-emerald-500/20 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/90">
              Real property performance
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-emerald-300">
              Know what each property is actually making
            </h2>
            <p className="mt-3 max-w-3xl text-[14px] leading-6 text-slate-400">
              See income, expenses, and net profit together for each property — not in separate
              apps. RentZentro gives you a clear property-by-property view so you can make better
              decisions faster.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950 p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Income</p>
                <p className="mt-1 text-lg font-semibold text-slate-50">Tracked</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950 p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Expenses</p>
                <p className="mt-1 text-lg font-semibold text-slate-50">Logged by property</p>
              </div>
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-950/25 p-3">
                <p className="text-[10px] uppercase tracking-wide text-emerald-200/80">Net</p>
                <p className="mt-1 text-lg font-semibold text-emerald-200">Visible instantly</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rz-fade-up rz-delay-6 border-t border-slate-900 py-14">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Why landlords switch
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-50">
              One system instead of scattered tools
            </h2>
            <p className="mt-2 max-w-3xl text-[14px] leading-6 text-slate-400">
              Most landlords piece together spreadsheets, payment apps, notes, and texts just to
              keep up. RentZentro replaces that patchwork with one connected system.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950 p-5 transition duration-300 hover:-translate-y-1 hover:border-emerald-500/20 hover:bg-slate-900/70">
              <p className="text-sm font-semibold text-slate-50">Without RentZentro</p>
              <div className="mt-4 space-y-3 text-[13px] text-slate-400">
                {[
                  'Rent tracked in one place',
                  'Expenses somewhere else',
                  'Tenants in texts and emails',
                  'Maintenance in your head',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <span className="mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/14 text-[11px] text-emerald-300">
                      ✓
                    </span>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-slate-950 to-slate-950 p-5 transition duration-300 hover:-translate-y-1 hover:border-emerald-500/20">
              <p className="text-sm font-semibold text-slate-50">With RentZentro</p>
              <div className="mt-4 space-y-3 text-[13px] text-slate-200">
                {[
                  'Everything in one dashboard',
                  'Profit visible instantly',
                  'Tenants and rent connected',
                  'Maintenance fully tracked',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <span className="mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/14 text-[11px] text-emerald-300">
                      ✓
                    </span>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rz-fade-up rz-delay-7 border-t border-slate-900 py-14">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Pricing
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-50">
                Clear plans based on your number of units
              </h2>
              <p className="mt-2 max-w-3xl text-[14px] leading-6 text-slate-400">
                Start with a free trial. Then choose a plan that fits your portfolio size.
                Every plan includes rent collection, maintenance, documents, and financial
                visibility.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {pricingPlans.map((plan) => (
              <PricingCard key={plan.name} plan={plan} />
            ))}
          </div>
        </section>

        <section className="rz-fade-up rz-delay-7 border-t border-slate-900 py-14">
          <div className="mb-6 rounded-3xl border border-sky-300/40 bg-gradient-to-br from-sky-500/20 via-slate-950 to-slate-950 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-100">
              New on RentZentro
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-50">
              Helpful day-to-day tools for landlords and the tenant experiance
            </h2>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-slate-300">
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-sky-300/20 bg-slate-950/60 p-4">
                <p className="text-sm font-semibold text-slate-50">
                  Location-based maintenance directory
                </p>
                <p className="mt-2 text-[13px] leading-6 text-slate-300">
                  Find plumbers, electricians, HVAC pros, and more by location. Save preferred
                  vendors to keep dispatch fast and organized.
                </p>
                <div className="mt-3">
                  <Link
                    href="/landlord/login?redirect=%2Flandlord%2Fmaintenance-directory"
                    className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-200 transition duration-200 hover:scale-[1.02] hover:border-sky-300/40 hover:bg-white/5 active:scale-95"
                  >
                    Explore maintenance directory
                  </Link>
                </div>
              </div>


              <div className="rounded-2xl border border-sky-300/35 bg-gradient-to-br from-sky-500/20 to-slate-950 p-4 shadow-[0_0_0_1px_rgba(125,211,252,0.2)]">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-100">
                  Highlighted feature
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-50">Lease / Document builder with optional AI assistance</p>
                <p className="mt-2 text-[13px] leading-6 text-slate-200">
                  Build stronger lease drafts manually or with optional AI-generated suggestions.
                  You stay in control of edits, clauses, and final approval before sending or exporting anything.
                </p>
                <div className="mt-3">
                  <Link
                    href="/landlord/login?redirect=%2Flandlord%2Fdocuments"
                    className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-sky-200/40 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 transition duration-200 hover:scale-[1.02] hover:border-sky-200 hover:bg-white/5 active:scale-95"
                  >
                    Try lease / document builder
                  </Link>
                </div>
              </div>
              <div className="rounded-2xl border border-sky-300/20 bg-slate-950/60 p-4">
                <p className="text-sm font-semibold text-slate-50">Tenant Explore Nearby</p>
                <p className="mt-2 text-[13px] leading-6 text-slate-300">
                Give your tenants a better living experience with local recommendations like restaurants, parks, essentials,
                  weekend events and farmers markets right from their portal.
                </p>
                <div className="mt-3">
                  <Link
                    href="/tenant/login"
                    className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-200 transition duration-200 hover:scale-[1.02] hover:border-sky-300/40 hover:bg-white/5 active:scale-95"
                  >
                    See tenant portal features
                  </Link>
                </div>
              </div>
            </div>
          </div>

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

        <section className="rz-fade-up rz-delay-8 border-t border-slate-900 py-14">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Landlord feedback
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-50">
                Built to feel simple
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

        <section className="rz-fade-up rz-delay-8 border-t border-slate-900 py-14">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Nationwide listings
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-50">
                Find your next rental faster.
              </h2>
              <p className="mt-2 text-[13px] leading-6 text-slate-400">
                Search rentals across top platforms in seconds.
              </p>
            </div>

            <Link
              href="/listings"
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 transition duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-95 md:w-auto"
            >
              Search rentals
            </Link>
          </div>

          {publicListings.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950 p-5 transition duration-300 hover:border-emerald-500/20 hover:bg-slate-900/70">
              <p className="text-sm font-semibold text-slate-100">
                Landlords can create listings and share them anywhere.
              </p>
              <p className="mt-1 text-[12px] leading-5 text-slate-400">
                RentZentro does not auto-post to listing platforms. You stay in control of where
                your listing is shared.
              </p>
            </div>
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

        <section className="rz-fade-up rz-delay-8 border-t border-slate-900 py-14">
          <div className="rounded-3xl border border-emerald-400/30 bg-emerald-950/25 p-5 transition duration-300 hover:border-emerald-500/20 hover:shadow-[0_18px_45px_rgba(0,0,0,0.4)] sm:p-6">
            <h2 className="text-2xl font-semibold text-slate-50">
              Start managing your rentals the right way
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Set up your first property in minutes and see your real numbers immediately.
            </p>

            <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
              <Link
                href="/landlord/signup"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-95"
              >
                Start Free - No Card Required
              </Link>
              <Link
                href="/login"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-white/10 bg-slate-950 px-6 py-3 text-sm font-semibold text-slate-200 transition duration-200 hover:scale-[1.02] hover:border-emerald-400/40 hover:bg-white/5 active:scale-95"
              >
                Log in
              </Link>
            </div>

            <p className="mt-3 text-[12px] leading-5 text-slate-400">
              Free trial available • No credit card required • Secure payments via Stripe • Built for
              landlords across the U.S.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
