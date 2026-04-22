'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type VendorCategory = {
  id: string;
  label: string;
  emoji: string;
  description: string;
  searchTerm: string;
};

type PreferredVendor = {
  id: string;
  name: string;
  categoryId: string;
  phone: string;
  email: string;
  notes: string;
  createdAt: string;
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

const PREFERRED_VENDORS_STORAGE_KEY = 'rentzentro_preferred_vendors_v1';

export default function MaintenanceDirectoryPage() {
  const [location, setLocation] = useState('');
  const [preferredVendors, setPreferredVendors] = useState<PreferredVendor[]>(
    []
  );
  const [vendorName, setVendorName] = useState('');
  const [vendorCategoryId, setVendorCategoryId] = useState(
    VENDOR_CATEGORIES[0].id
  );
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorNotes, setVendorNotes] = useState('');
  const [vendorError, setVendorError] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(PREFERRED_VENDORS_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as PreferredVendor[];
      if (Array.isArray(parsed)) {
        setPreferredVendors(parsed);
      }
    } catch (err) {
      console.error('Failed to parse saved preferred vendors', err);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      PREFERRED_VENDORS_STORAGE_KEY,
      JSON.stringify(preferredVendors)
    );
  }, [preferredVendors]);

  const handleSaveVendor = (e: React.FormEvent) => {
    e.preventDefault();
    setVendorError(null);

    if (!vendorName.trim()) {
      setVendorError('Please add a vendor name before saving.');
      return;
    }

    const newVendor: PreferredVendor = {
      id: `${Date.now()}`,
      name: vendorName.trim(),
      categoryId: vendorCategoryId,
      phone: vendorPhone.trim(),
      email: vendorEmail.trim(),
      notes: vendorNotes.trim(),
      createdAt: new Date().toISOString(),
    };

    setPreferredVendors((prev) => [newVendor, ...prev]);
    setVendorName('');
    setVendorPhone('');
    setVendorEmail('');
    setVendorNotes('');
  };

  const handleDeleteVendor = (id: string) => {
    setPreferredVendors((prev) => prev.filter((item) => item.id !== id));
  };

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

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Preferred vendors
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-50">
                Save your go-to maintenance pros
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Keep frequently used vendors handy for faster dispatch.
              </p>
            </div>
            <p className="text-xs text-slate-500">
              Saved: {preferredVendors.length}
            </p>
          </div>

          <form onSubmit={handleSaveVendor} className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="Vendor name"
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/50 placeholder:text-slate-500 focus:ring"
              />
              <select
                value={vendorCategoryId}
                onChange={(e) => setVendorCategoryId(e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/50 focus:ring"
              >
                {VENDOR_CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
              <input
                value={vendorPhone}
                onChange={(e) => setVendorPhone(e.target.value)}
                placeholder="Phone (optional)"
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/50 placeholder:text-slate-500 focus:ring"
              />
              <input
                value={vendorEmail}
                onChange={(e) => setVendorEmail(e.target.value)}
                placeholder="Email (optional)"
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/50 placeholder:text-slate-500 focus:ring"
              />
            </div>

            <textarea
              value={vendorNotes}
              onChange={(e) => setVendorNotes(e.target.value)}
              rows={2}
              placeholder="Notes (response time, specialties, pricing, etc.)"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/50 placeholder:text-slate-500 focus:ring"
            />

            {vendorError && (
              <p className="text-xs text-rose-300">{vendorError}</p>
            )}

            <button
              type="submit"
              className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Save preferred vendor
            </button>
          </form>

          {preferredVendors.length === 0 ? (
            <p className="mt-4 text-xs text-slate-500">
              No preferred vendors saved yet.
            </p>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {preferredVendors.map((vendor) => {
                const category = VENDOR_CATEGORIES.find(
                  (item) => item.id === vendor.categoryId
                );
                return (
                  <article
                    key={vendor.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">
                          {vendor.name}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {category?.label || 'Vendor'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteVendor(vendor.id)}
                        className="text-[11px] text-rose-300 hover:text-rose-200"
                      >
                        Remove
                      </button>
                    </div>
                    {(vendor.phone || vendor.email) && (
                      <p className="mt-2 text-xs text-slate-300">
                        {vendor.phone && <span>{vendor.phone}</span>}
                        {vendor.phone && vendor.email && (
                          <span className="mx-1 text-slate-500">·</span>
                        )}
                        {vendor.email && <span>{vendor.email}</span>}
                      </p>
                    )}
                    {vendor.notes && (
                      <p className="mt-2 text-xs text-slate-400">
                        {vendor.notes}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
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
