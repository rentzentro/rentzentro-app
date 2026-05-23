import Link from 'next/link';
import { redirect } from 'next/navigation';

import ListingsSearchForm from './ListingsSearchForm';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '../supabaseClient';
import BackButton from './BackButton';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SearchParams = {
  source?: string | string[];
  location?: string | string[];
  beds?: string | string[];
  baths?: string | string[];
  minRent?: string | string[];
  maxRent?: string | string[];
};


const pickFirst = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

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
};

const normalize = (value?: string | string[]) => pickFirst(value)?.trim() || '';
const toNumber = (value?: string | string[]) => {
  const raw = normalize(value);
  if (!raw) return null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
};

const hasAnyCriteria = (params: SearchParams) =>
  Boolean(params.location || params.beds || params.baths || params.minRent || params.maxRent);

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

async function searchRentzentroListings(params: SearchParams): Promise<Listing[]> {
  if (!hasAnyCriteria(params) || !isSupabaseBrowserConfigured()) return [];

  const supabase = getSupabaseBrowserClient();
  const location = normalize(params.location).toLowerCase();
  const beds = toNumber(params.beds);
  const baths = toNumber(params.baths);
  const minRent = toNumber(params.minRent);
  const maxRent = toNumber(params.maxRent);

  let query = supabase
    .from('listings')
    .select('id,title,slug,city,state,neighborhood,rent_amount,beds,baths')
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(60);

  if (beds !== null) query = query.gte('beds', beds);
  if (baths !== null) query = query.gte('baths', baths);
  if (minRent !== null) query = query.gte('rent_amount', minRent);
  if (maxRent !== null) query = query.lte('rent_amount', maxRent);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data || []) as Listing[];
  if (!location) return rows;

  return rows.filter((listing) => {
    const haystack = [listing.neighborhood, listing.city, listing.state]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(location);
  });
}

export default async function PublicListingsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = ((await searchParams) || {}) as SearchParams;
  const sourceParam = pickFirst(params.source);
  const source = sourceParam === 'web' ? 'web' : 'rentzentro';

  if (source === 'web' && hasAnyCriteria(params)) {
    const query = buildGoogleQuery(params);
    redirect(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
  }

  const listings = await searchRentzentroListings(params);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_50px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:p-8">
          <p className="inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
            RENTAL SEARCH
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Where will you end up?</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Search live RentZentro listings, or use the web search button if you want broader results.
          </p>

          <ListingsSearchForm defaultLocation={params.location} />

          {hasAnyCriteria(params) ? (
            <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <h2 className="text-lg font-semibold text-slate-100">RentZentro results</h2>
              {listings.length === 0 ? (
                <p className="mt-2 text-sm text-slate-300">No matching RentZentro listings yet. Try broadening your filters or search the web.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {listings.map((listing) => (
                    <li key={listing.id} className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                      <Link href={`/listings/${listing.slug}`} className="text-base font-semibold text-emerald-300 hover:text-emerald-200">
                        {listing.title}
                      </Link>
                      <p className="mt-1 text-sm text-slate-300">
                        {[listing.neighborhood, listing.city, listing.state].filter(Boolean).join(', ') || 'Location coming soon'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-3 pt-1">
            <BackButton />
            <Link href="/" className="rz-btn-nav">Back to homepage</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
