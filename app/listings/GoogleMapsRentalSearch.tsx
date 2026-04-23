'use client';

import { FormEvent, useMemo, useState } from 'react';

const toCurrencyNumber = (value: string) => {
  const digits = value.replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
};

const money = (value: number | null) => (value == null ? null : value.toLocaleString('en-US'));

const buildMapsUrl = (params: {
  location: string;
  beds: string;
  baths: string;
  minRent: string;
  maxRent: string;
}) => {
  const queryParts: string[] = ['apartments for rent'];

  if (params.location.trim()) {
    queryParts.push(`in ${params.location.trim()}`);
  }

  if (params.beds) {
    queryParts.push(params.beds === 'studio' ? 'studio' : `${params.beds}+ bedrooms`);
  }

  if (params.baths) {
    queryParts.push(`${params.baths}+ bathrooms`);
  }

  const minRent = toCurrencyNumber(params.minRent);
  const maxRent = toCurrencyNumber(params.maxRent);
  if (minRent && maxRent) {
    queryParts.push(`rent between $${money(minRent)} and $${money(maxRent)}`);
  } else if (minRent) {
    queryParts.push(`rent at least $${money(minRent)}`);
  } else if (maxRent) {
    queryParts.push(`rent under $${money(maxRent)}`);
  }

  return `https://www.google.com/maps/search/${encodeURIComponent(queryParts.join(' '))}`;
};

export default function GoogleMapsRentalSearch() {
  const [location, setLocation] = useState('');
  const [beds, setBeds] = useState('');
  const [baths, setBaths] = useState('');
  const [minRent, setMinRent] = useState('');
  const [maxRent, setMaxRent] = useState('');

  const previewUrl = useMemo(
    () => buildMapsUrl({ location, beds, baths, minRent, maxRent }),
    [location, beds, baths, minRent, maxRent]
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Search beyond RentZentro
      </p>
      <h2 className="mt-1 text-lg font-semibold text-slate-50">
        Find rentals on Google Maps with your criteria
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Enter your filters and we&apos;ll open Google Maps results in a new tab.
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (city, ZIP, neighborhood)"
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/50 placeholder:text-slate-500 focus:ring lg:col-span-2"
          />
          <select
            value={beds}
            onChange={(e) => setBeds(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/50 focus:ring"
          >
            <option value="">Any beds</option>
            <option value="studio">Studio</option>
            <option value="1">1+ bed</option>
            <option value="2">2+ beds</option>
            <option value="3">3+ beds</option>
            <option value="4">4+ beds</option>
          </select>
          <select
            value={baths}
            onChange={(e) => setBaths(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/50 focus:ring"
          >
            <option value="">Any baths</option>
            <option value="1">1+ bath</option>
            <option value="1.5">1.5+ baths</option>
            <option value="2">2+ baths</option>
            <option value="3">3+ baths</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={minRent}
              onChange={(e) => setMinRent(e.target.value)}
              inputMode="numeric"
              placeholder="Min $"
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/50 placeholder:text-slate-500 focus:ring"
            />
            <input
              value={maxRent}
              onChange={(e) => setMaxRent(e.target.value)}
              inputMode="numeric"
              placeholder="Max $"
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/50 placeholder:text-slate-500 focus:ring"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Google Maps query preview: <span className="text-slate-400">{decodeURIComponent(previewUrl)}</span>
          </p>
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 transition duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-95"
          >
            Search on Google Maps
          </button>
        </div>
      </form>
    </section>
  );
}
