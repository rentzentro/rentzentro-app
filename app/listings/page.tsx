import Link from 'next/link';
import { redirect } from 'next/navigation';

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
            Find rentals on Google Maps
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Enter your criteria below and we’ll take you directly to Google Maps results with your
            rental search already filled in.
          </p>

          <form method="GET" className="mt-7 grid gap-3 md:grid-cols-2 lg:grid-cols-6">
            <label className="lg:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-300">Location</span>
              <input
                type="text"
                name="location"
                placeholder="City, neighborhood, or state"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-medium text-slate-300">Beds (min)</span>
              <input
                type="number"
                min="0"
                step="1"
                name="beds"
                placeholder="Any"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-medium text-slate-300">Baths (min)</span>
              <input
                type="number"
                min="0"
                step="0.5"
                name="baths"
                placeholder="Any"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-medium text-slate-300">Min rent</span>
              <input
                type="number"
                min="0"
                step="50"
                name="minRent"
                placeholder="$0"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-medium text-slate-300">Max rent</span>
              <input
                type="number"
                min="0"
                step="50"
                name="maxRent"
                placeholder="No cap"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
              />
            </label>

            <div className="flex flex-wrap gap-3 pt-1 lg:col-span-6">
              <button
                type="submit"
                className="inline-flex items-center rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                Search on Google Maps
              </button>
              <Link
                href="/"
                className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
              >
                Back to homepage
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
