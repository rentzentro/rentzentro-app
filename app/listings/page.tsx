import Link from 'next/link';
import { redirect } from 'next/navigation';

import ListingsSearchForm from './ListingsSearchForm';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '../supabaseClient';
import BackButton from './BackButton';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

const MAP_PINS = [
  { left: '28%', top: '34%', label: '$1.9K' },
  { left: '43%', top: '47%', label: '$2.4K' },
  { left: '57%', top: '29%', label: '$3.1K' },
  { left: '66%', top: '58%', label: '$2.7K' },
  { left: '35%', top: '66%', label: '$1.6K' },
  { left: '74%', top: '39%', label: '$3.8K' },
];

type SearchParams = {
  source?: string | string[];
  location?: string | string[];
  beds?: string | string[];
  baths?: string | string[];
  minRent?: string | string[];
  maxRent?: string | string[];
  page?: string | string[];
};

const pickFirst = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);
const pickLast = (value?: string | string[]) => (Array.isArray(value) ? value[value.length - 1] : value);

type Listing = {
  id: number;
  title: string;
  slug: string;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  rent_amount: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  available_date: string | null;
};

type PhotoRow = {
  id: number;
  listing_id: number;
  image_url: string;
  sort_order: number;
};

const normalize = (value?: string | string[]) => pickFirst(value)?.trim() || '';
const toNumber = (value?: string | string[]) => {
  const raw = normalize(value);
  if (!raw) return null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
};

const money = (value: number | null | undefined) =>
  value == null || isNaN(value) ? null : `$${value.toLocaleString('en-US')}`;

const fmtDate = (value: string | null | undefined) => {
  if (!value) return null;

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date(value);

  if (isNaN(date.getTime())) return null;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const hasAnyCriteria = (params: SearchParams) =>
  Boolean(params.location || params.beds || params.baths || params.minRent || params.maxRent);

const toPositiveInt = (value?: string | string[]) => {
  const raw = normalize(value);
  const numeric = Number(raw);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : 1;
};

const buildGoogleQuery = (params: SearchParams) => {
  const location = normalize(params.location);
  const beds = normalize(params.beds);
  const baths = normalize(params.baths);
  const minRent = normalize(params.minRent);
  const maxRent = normalize(params.maxRent);

  const parts = ['apartments for rent'];

  if (location) parts.push(`in ${location}`);
  if (beds) parts.push(`${beds}+ beds`);
  if (baths) parts.push(`${baths}+ baths`);

  if (minRent && maxRent) {
    parts.push(`$${minRent} to $${maxRent} rent`);
  } else if (minRent) {
    parts.push(`minimum $${minRent} rent`);
  } else if (maxRent) {
    parts.push(`up to $${maxRent} rent`);
  }

  return parts.join(' ');
};

async function searchRentzentroListings(
  params: SearchParams,
  page: number
): Promise<{ listings: Listing[]; hasNextPage: boolean; coverMap: Map<number, PhotoRow> }> {
  if (!isSupabaseBrowserConfigured()) {
    return { listings: [], hasNextPage: false, coverMap: new Map<number, PhotoRow>() };
  }

  const supabase = getSupabaseBrowserClient();
  const location = normalize(params.location).toLowerCase();
  const beds = toNumber(params.beds);
  const baths = toNumber(params.baths);
  const minRent = toNumber(params.minRent);
  const maxRent = toNumber(params.maxRent);

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE;

  let query = supabase
    .from('listings')
    .select('id,title,slug,city,state,neighborhood,rent_amount,beds,baths,sqft,available_date')
    .eq('published', true)
    .order('published_at', { ascending: false })
    .range(from, to);

  if (beds !== null) query = query.gte('beds', beds);
  if (baths !== null) query = query.gte('baths', baths);
  if (minRent !== null) query = query.gte('rent_amount', minRent);
  if (maxRent !== null) query = query.lte('rent_amount', maxRent);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data || []) as Listing[];
  const dedupedRows = Array.from(new Map(rows.map((listing) => [listing.id, listing])).values());
  const filteredRows = !location
    ? dedupedRows
    : dedupedRows.filter((listing) => {
        const haystack = [listing.neighborhood, listing.city, listing.state]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(location);
      });

  const listings = filteredRows.slice(0, PAGE_SIZE);
  const ids = listings.map((listing) => listing.id);
  const coverMap = new Map<number, PhotoRow>();

  if (ids.length > 0) {
    const { data: photosData } = await supabase
      .from('listing_photos')
      .select('id, listing_id, image_url, sort_order')
      .in('listing_id', ids)
      .order('sort_order', { ascending: true });

    for (const row of (photosData || []) as PhotoRow[]) {
      if (!coverMap.has(row.listing_id)) coverMap.set(row.listing_id, row);
    }
  }

  return {
    listings,
    hasNextPage: filteredRows.length > PAGE_SIZE,
    coverMap,
  };
}

function buildPageHref(params: SearchParams, page: number) {
  const qs = new URLSearchParams();
  qs.set('source', 'rentzentro');

  const fields: (keyof SearchParams)[] = ['location', 'beds', 'baths', 'minRent', 'maxRent'];
  for (const field of fields) {
    const value = normalize(params[field]);
    if (value) qs.set(field, value);
  }

  if (page > 1) qs.set('page', String(page));
  return `/listings?${qs.toString()}`;
}

function SearchMap({ count, location }: { count: number; location: string }) {
  return (
    <section className="relative min-h-[420px] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900 shadow-2xl lg:sticky lg:top-6 lg:min-h-[calc(100vh-3rem)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_24%,rgba(16,185,129,0.30),transparent_28%),radial-gradient(circle_at_78%_62%,rgba(59,130,246,0.24),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.88))]" />
      <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.13)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.13)_1px,transparent_1px)] [background-size:56px_56px]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 720 720" aria-hidden="true">
        <path d="M58 185 C175 78 278 109 361 190 S534 296 660 178" stroke="rgba(148,163,184,.4)" strokeWidth="18" fill="none" strokeLinecap="round" />
        <path d="M31 512 C173 423 288 458 395 540 S568 653 705 529" stroke="rgba(16,185,129,.35)" strokeWidth="16" fill="none" strokeLinecap="round" />
        <path d="M186 0 C230 148 244 250 196 369 S108 577 156 720" stroke="rgba(96,165,250,.35)" strokeWidth="14" fill="none" strokeLinecap="round" />
        <path d="M484 0 C438 144 458 262 530 350 S650 531 615 720" stroke="rgba(148,163,184,.32)" strokeWidth="12" fill="none" strokeLinecap="round" />
      </svg>

      <div className="absolute left-5 top-5 z-10 rounded-2xl border border-white/15 bg-slate-950/80 p-4 shadow-xl backdrop-blur-md">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Live rental map</p>
        <p className="mt-1 text-2xl font-bold text-white">{count || 'No'} homes</p>
        <p className="text-xs text-slate-300">{location || 'Nationwide RentZentro listings'}</p>
      </div>

      {MAP_PINS.map((pin, index) => (
        <div
          key={pin.label + index}
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-black text-slate-950 shadow-[0_12px_30px_rgba(16,185,129,0.36)] ring-4 ring-emerald-400/20"
          style={{ left: pin.left, top: pin.top }}
        >
          {pin.label}
        </div>
      ))}

      <div className="absolute bottom-5 left-5 right-5 z-10 rounded-3xl border border-white/15 bg-white/90 p-4 text-slate-950 shadow-2xl backdrop-blur-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold">Explore areas visually</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Zillow-style browsing feel with RentZentro inventory, fast filters, and cards that show the details renters actually scan first.
            </p>
          </div>
          <span className="rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold text-white">Map view</span>
        </div>
      </div>
    </section>
  );
}

function ListingCard({ listing, cover }: { listing: Listing; cover?: PhotoRow }) {
  const location = [listing.neighborhood, listing.city, listing.state].filter(Boolean).join(', ');
  const price = money(listing.rent_amount);
  const available = fmtDate(listing.available_date) || 'Now';
  const details = [
    listing.beds != null ? `${listing.beds} bd` : null,
    listing.baths != null ? `${listing.baths} ba` : null,
    listing.sqft != null ? `${listing.sqft.toLocaleString('en-US')} sqft` : null,
  ].filter(Boolean);

  return (
    <Link
      href={`/listings/${listing.slug}`}
      className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-300/60"
    >
      <div className="relative h-52 overflow-hidden bg-slate-200">
        {cover?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.image_url}
            alt={`${listing.title} cover photo`}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-100 via-sky-100 to-slate-200 text-sm font-semibold text-slate-500">
            Photo coming soon
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute left-3 top-3 rounded-full bg-slate-950/75 px-3 py-1 text-[11px] font-bold text-white shadow-lg backdrop-blur">
          Available {available}
        </div>
        <button
          type="button"
          aria-label="Save listing"
          className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-slate-950/55 text-white shadow-lg backdrop-blur transition group-hover:bg-rose-500"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
          </svg>
        </button>
      </div>

      <div className="p-4 text-slate-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-2xl font-black tracking-tight">{price ? `${price}/mo` : 'Contact for price'}</p>
            {details.length > 0 ? (
              <p className="mt-1 text-sm font-bold text-slate-700">{details.join(' · ')}</p>
            ) : null}
          </div>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">Verified</span>
        </div>
        <h2 className="mt-3 line-clamp-2 text-base font-bold leading-snug text-slate-900">{listing.title}</h2>
        <p className="mt-1 line-clamp-1 text-sm text-slate-600">{location || 'Location coming soon'}</p>
        <div className="mt-4 flex items-center gap-2">
          <span className="inline-flex flex-1 items-center justify-center rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-bold text-white transition group-hover:bg-blue-700">
            View details
          </span>
          <span className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700">Tour</span>
        </div>
      </div>
    </Link>
  );
}

export default async function PublicListingsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = ((await searchParams) || {}) as SearchParams;
  const sourceParam = pickLast(params.source);
  const source = sourceParam === 'web' ? 'web' : 'rentzentro';
  const page = toPositiveInt(params.page);

  if (source === 'web') {
    const query = hasAnyCriteria(params) ? buildGoogleQuery(params) : 'apartments for rent near me';
    redirect(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
  }

  const { listings, hasNextPage, coverMap } = await searchRentzentroListings(params, page);
  const location = normalize(params.location);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-[1520px] items-center justify-between gap-4">
          <Link href="/" className="text-xl font-black tracking-tight text-slate-950">
            Rent<span className="text-emerald-600">Zentro</span>
          </Link>
          <div className="hidden items-center gap-6 text-sm font-semibold text-slate-700 md:flex">
            <Link href="/listings" className="hover:text-emerald-600">Rent</Link>
            <Link href="/landlord/signup" className="hover:text-emerald-600">List a rental</Link>
            <Link href="/landlord/login" className="hover:text-emerald-600">Manage rentals</Link>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1520px] gap-4 p-4 lg:grid-cols-[minmax(420px,1fr)_minmax(520px,720px)]">
        <SearchMap count={listings.length} location={location} />

        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl">
          <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 p-4 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Rental search</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                  {location ? `Homes for rent in ${location}` : 'Homes for rent near you'}
                </h1>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
                Showing up to {PAGE_SIZE}
              </span>
            </div>

            <ListingsSearchForm
              defaultLocation={pickFirst(params.location)}
              defaultBeds={pickFirst(params.beds)}
              defaultBaths={pickFirst(params.baths)}
              defaultMinRent={pickFirst(params.minRent)}
              defaultMaxRent={pickFirst(params.maxRent)}
            />
          </div>

          <div className="max-h-none overflow-y-auto bg-slate-50 p-4 lg:max-h-[calc(100vh-2rem)]">
            <div className="mb-4 rounded-3xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950">
              <p className="font-bold">A livelier browsing experience is here.</p>
              <p className="mt-1 text-blue-800">
                Photo-led cards, quick facts, save affordances, and a visual map panel make RentZentro listings feel active instead of like a plain directory.
              </p>
            </div>

            {listings.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
                <p className="text-2xl font-black text-slate-950">No matching RentZentro listings yet</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                  Try broadening your filters, searching another city, or jump to web results for a wider scan.
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-4 xl:grid-cols-2">
                  {listings.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} cover={coverMap.get(listing.id)} />
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between">
                  {page > 1 ? (
                    <Link href={buildPageHref(params, page - 1)} className="rz-btn-nav bg-white text-slate-900">
                      Previous page
                    </Link>
                  ) : (
                    <span />
                  )}
                  {hasNextPage ? (
                    <Link href={buildPageHref(params, page + 1)} className="rz-btn-nav bg-white text-slate-900">
                      Next page
                    </Link>
                  ) : null}
                </div>
              </>
            )}

            <div className="mt-5 flex flex-wrap gap-3 pt-1">
              <BackButton />
              <Link href="/" className="rz-btn-nav bg-white text-slate-900">Back to homepage</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
