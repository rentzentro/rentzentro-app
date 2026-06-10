import Link from 'next/link';
import { redirect } from 'next/navigation';

import ListingsSearchForm from './ListingsSearchForm';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '../supabaseClient';
import BackButton from './BackButton';
import SaveListingButton from './SaveListingButton';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

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

const buildGoogleMapsHref = (params: SearchParams) => {
  const query = hasAnyCriteria(params) ? buildGoogleQuery(params) : 'apartments for rent near me';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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

function ResultsSummary({ count, location, mapHref }: { count: number; location: string; mapHref: string }) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 shadow-2xl shadow-slate-950/40">
      <div className="relative p-5 sm:p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(37,99,235,0.18),transparent_25%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-300">Live RentZentro inventory</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
              {count || 'No'} {count === 1 ? 'home' : 'homes'} {location ? `in ${location}` : 'ready to browse'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              The decorative map has been removed. Use the real map button to open your current filters in Google Maps, or keep browsing RentZentro listings below.
            </p>
          </div>
          <a
            href={mapHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-400 px-5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-300"
          >
            View real map
          </a>
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
    <article className="group overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-sm shadow-slate-950/30 transition duration-300 hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-950/20">
      <div className="relative h-52 overflow-hidden bg-slate-900">
        {cover?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.image_url}
            alt={`${listing.title} cover photo`}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-950 via-sky-950 to-slate-900 text-sm font-semibold text-slate-300">
            Photo coming soon
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute left-3 top-3 rounded-full bg-slate-950/80 px-3 py-1 text-[11px] font-bold text-white shadow-lg backdrop-blur">
          Available {available}
        </div>
        <SaveListingButton listingId={listing.id} listingTitle={listing.title} />
      </div>

      <div className="p-4 text-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-2xl font-black tracking-tight text-white">{price ? `${price}/mo` : 'Contact for price'}</p>
            {details.length > 0 ? (
              <p className="mt-1 text-sm font-bold text-slate-300">{details.join(' · ')}</p>
            ) : null}
          </div>
          <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-400/25">Verified</span>
        </div>
        <h2 className="mt-3 line-clamp-2 text-base font-bold leading-snug text-white">{listing.title}</h2>
        <p className="mt-1 line-clamp-1 text-sm text-slate-400">{location || 'Location coming soon'}</p>
        <div className="mt-4 flex items-center gap-2">
          <Link
            href={`/listings/${listing.slug}`}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-blue-500"
          >
            View details
          </Link>
          <Link
            href={`/listings/${listing.slug}#contact`}
            className="rounded-xl border border-slate-700 px-3 py-2.5 text-xs font-bold text-slate-200 transition hover:border-emerald-400 hover:text-emerald-300"
          >
            Tour
          </Link>
        </div>
      </div>
    </article>
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
    redirect(buildGoogleMapsHref(params));
  }

  const { listings, hasNextPage, coverMap } = await searchRentzentroListings(params, page);
  const location = normalize(params.location);
  const mapHref = buildGoogleMapsHref(params);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 bg-slate-950/95 px-4 py-3 shadow-sm shadow-slate-950/40 backdrop-blur">
        <div className="mx-auto flex max-w-[1520px] items-center justify-between gap-4">
          <Link href="/" className="text-xl font-black tracking-tight text-white">
            Rent<span className="text-emerald-400">Zentro</span>
          </Link>
          <div className="hidden items-center gap-6 text-sm font-semibold text-slate-300 md:flex">
            <Link href="/listings" className="hover:text-emerald-300">Rent</Link>
            <Link href="/landlord/signup" className="hover:text-emerald-300">List a rental</Link>
            <Link href="/landlord/login" className="hover:text-emerald-300">Manage rentals</Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1520px] space-y-4 p-4">
        <ResultsSummary count={listings.length} location={location} mapHref={mapHref} />

        <section className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900 shadow-xl shadow-slate-950/40">
          <div className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900/95 p-4 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Rental search</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                  {location ? `Homes for rent in ${location}` : 'Homes for rent near you'}
                </h1>
              </div>
              <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-bold text-slate-300">
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

          <div className="bg-slate-950 p-4">
            <div className="mb-4 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-50">
              <p className="font-bold">A livelier browsing experience is here.</p>
              <p className="mt-1 text-emerald-100/80">
                Photo-led cards, quick facts, and working save actions keep RentZentro listings useful without a fake map taking over the page.
              </p>
            </div>

            {listings.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900 p-8 text-center shadow-sm">
                <p className="text-2xl font-black text-white">No matching RentZentro listings yet</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-300">
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
                    <Link href={buildPageHref(params, page - 1)} className="rz-btn-nav">
                      Previous page
                    </Link>
                  ) : (
                    <span />
                  )}
                  {hasNextPage ? (
                    <Link href={buildPageHref(params, page + 1)} className="rz-btn-nav">
                      Next page
                    </Link>
                  ) : null}
                </div>
              </>
            )}

            <div className="mt-5 flex flex-wrap gap-3 pt-1">
              <BackButton />
              <Link href="/" className="rz-btn-nav">Back to homepage</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
