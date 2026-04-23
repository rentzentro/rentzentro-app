import Link from 'next/link';
import { redirect } from 'next/navigation';

import ListingsSearchForm from './ListingsSearchForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SearchParams = {
  location?: string;
  beds?: string;
  baths?: string;
  minRent?: string;
  maxRent?: string;
};

const normalize = (value?: string) => value?.trim() || '';

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

export default async function PublicListingsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = ((await searchParams) || {}) as SearchParams;

  if (hasAnyCriteria(params)) {
    const query = buildGoogleQuery(params);
    redirect(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_50px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:p-8">
          <p className="inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
            RentZentro Search
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Where will you end up?
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Enter your criteria below and we’ll search for you.

          </p>

          <ListingsSearchForm defaultLocation={params.location} />

          <div className="mt-3 flex flex-wrap gap-3 pt-1">
            <Link
              href="/"
              className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
            >
              Back to homepage
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
