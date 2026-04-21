'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type VendorCategory = {
  id: string;
  label: string;
  emoji: string;
  description: string;
  searchTerm: string;
};

const VENDOR_CATEGORIES: VendorCategory[] = [
  {
    id: 'electrician',
    label: 'Electricians',
    emoji: '⚡',
    description: 'Panels, breakers, outlets, wiring, and emergency power issues.',
    searchTerm: 'licensed electrician',
  },
  {
    id: 'plumber',
    label: 'Plumbers',
    emoji: '🚰',
    description: 'Leaks, water heaters, drain backups, and fixture replacements.',
    searchTerm: '24 hour plumber',
  },
  {
    id: 'general-contractor',
    label: 'General contractors',
    emoji: '🧱',
    description: 'Larger repairs, renovation projects, and multi-trade jobs.',
    searchTerm: 'general contractor',
  },
  {
    id: 'hvac',
    label: 'HVAC technicians',
    emoji: '🌡️',
    description: 'Heating/AC outages, maintenance, and system replacements.',
    searchTerm: 'hvac repair',
  },
  {
    id: 'handyman',
    label: 'Handyman services',
    emoji: '🪛',
    description: 'Small repairs, drywall patching, doors, locks, and touch-ups.',
    searchTerm: 'handyman',
  },
  {
    id: 'appliance',
    label: 'Appliance repair',
    emoji: '🧺',
    description: 'Stove, refrigerator, washer, dryer, and dishwasher service.',
    searchTerm: 'appliance repair service',
  },
];

const buildSearchUrl = (searchTerm: string, location: string) => {
  const query = [searchTerm, location.trim()].filter(Boolean).join(' near ');
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
};

export default function MaintenanceDirectoryPage() {
  const [location, setLocation] = useState('');

  const locationHint = useMemo(() => {
    if (!location.trim()) {
      return 'Tip: add a city, ZIP, or neighborhood to search near a specific rental.';
    }

    return `Searching near: ${location.trim()}`;
  }, [location]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Landlord tools</p>
            <h1 className="mt-1 text-2xl font-semibold">Maintenance worker directory</h1>
            <p className="mt-2 text-sm text-slate-300 max-w-2xl">
              Quickly find nearby service pros for repairs. Choose a category to open a local search
              in a new tab.
            </p>
          </div>

          <Link
            href="/landlord"
            className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800"
          >
            Back to dashboard
          </Link>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <label htmlFor="location" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Rental location (optional)
          </label>
          <input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Example: 78704, Austin TX"
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/50 placeholder:text-slate-500 focus:ring"
          />
          <p className="mt-2 text-xs text-slate-400">{locationHint}</p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {VENDOR_CATEGORIES.map((item) => (
            <a
              key={item.id}
              href={buildSearchUrl(item.searchTerm, location)}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 hover:border-emerald-500/60 hover:bg-slate-900/80 transition-colors"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-base">
                  {item.emoji}
                </span>
                {item.label}
              </p>
              <p className="mt-2 text-xs text-slate-400">{item.description}</p>
              <p className="mt-3 text-[11px] font-medium text-emerald-300">Open nearby results ↗</p>
            </a>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Reminder</p>
          <p className="mt-2 text-xs text-amber-100/90">
            Verify licensing, insurance, and reviews before hiring. For emergencies involving active
            fire, gas leaks, or life safety, contact local emergency services first.
          </p>
        </section>
      </div>
    </main>
  );
}
