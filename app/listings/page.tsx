// app/listings/page.tsx

import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  { auth: { persistSession: false } }
);

const money = (n: number | null) =>
  n == null ? null : n.toLocaleString('en-US', { maximumFractionDigits: 0 });

type DemoListing = {
  title: string;
  loc: string;
  rent: string;
  beds: string;
  baths: string;
  image: string;
};

const demoListings: DemoListing[] = [
  {
    title: 'Bright 2BR • Renovated kitchen • Parking',
    loc: 'East Side, Providence, RI',
    rent: '$2,350/mo',
    beds: '2',
    baths: '1',
    image:
      'https://images.unsplash.com/photo-1501183638710-841dd1904471?auto=format&fit=crop&w=1400&q=70',
  },
  {
    title: 'Modern 1BR • In-unit laundry • Gym access',
    loc: 'Somerville, MA',
    rent: '$2,150/mo',
    beds: '1',
    baths: '1',
    image:
      'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1400&q=70',
  },
  {
    title: 'Spacious 3BR • Backyard • Pet-friendly',
    loc: 'Warwick, RI',
    rent: '$2,850/mo',
    beds: '3',
    baths: '1.5',
    image:
      'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=70',
  },
  {
    title: 'Clean studio • Walkable neighborhood • Great light',
    loc: 'Cambridge, MA',
    rent: '$1,950/mo',
    beds: 'Studio',
    baths: '1',
    image:
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=70',
  },
  {
    title: 'Updated 2BR • Balcony • Quiet building',
    loc: 'Cranston, RI',
    rent: '$2,250/mo',
    beds: '2',
    baths: '1',
    image:
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1400&q=70',
  },
  {
    title: '3BR • Off-street parking • Close to transit',
    loc: 'Quincy, MA',
    rent: '$3,150/mo',
    beds: '3',
    baths: '2',
    image:
      'https://images.unsplash.com/photo-1502005097973-6a7082348e28?auto=format&fit=crop&w=1400&q=70',
  },
];

export default async function PublicListingsPage() {
  const { data: listings } = await supabase
    .from('listings')
    .select(
      `
      id,
      title,
      slug,
      city,
      state,
      neighborhood,
      rent_amount,
      beds,
      baths,
      listing_photos (
        image_url,
        sort_order
      )
    `
    )
    .eq('published', true)
    .order('published_at', { ascending: false });

  const hasListings = listings && listings.length > 0;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Available rentals</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Browse listings managed through RentZentro. Each property is published directly by its
            landlord and kept up to date in real time.
          </p>
        </div>

        {/* Listings */}
        {hasListings ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {listings!.map((l: any) => {
              const photos = (l.listing_photos || []).sort(
                (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
              );
              const coverUrl = photos[0]?.image_url ?? null;

              const loc =
                l.neighborhood || (l.city && l.state ? `${l.city}, ${l.state}` : null);

              return (
                <Link key={l.id} href={`/listings/${l.slug}`} className="group">
                  <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70 transition hover:border-emerald-500/40">
                    {/* Image */}
                    <div className="relative flex h-40 items-center justify-center bg-slate-900">
                      {coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coverUrl} alt={l.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                          Listing preview
                        </div>
                      )}

                      {/* Overlay */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                        <p className="truncate text-sm font-semibold text-slate-100">{l.title}</p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-200/80">
                          {loc || 'Neighborhood available upon inquiry'}
                        </p>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-emerald-300">
                          {money(l.rent_amount) ? `$${money(l.rent_amount)}/mo` : 'Rent on request'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {(l.beds ?? '—')} bd · {(l.baths ?? '—')} ba
                        </p>
                      </div>

                      <div className="mt-3 inline-flex items-center text-xs font-medium text-emerald-300 group-hover:text-emerald-200">
                        View details →
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <>
            {/* Premium empty state: show demo listings (NOT "no listings") */}
            <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-200">Listings update frequently</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Here’s a preview of what RentZentro listings look like. Real rentals appear here
                    automatically when landlords publish availability.
                  </p>
                </div>

                <div className="mt-2 md:mt-0">
                  <Link
                    href="/landlord/signup"
                    className="inline-flex rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                  >
                    Landlords: publish a listing →
                  </Link>
                </div>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {demoListings.map((d) => (
                <div key={d.title} className="group">
                  <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70">
                    {/* Image */}
                    <div className="relative flex h-40 items-center justify-center bg-slate-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={d.image}
                        alt="Example listing"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />

                      {/* Overlay */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                        <p className="truncate text-sm font-semibold text-slate-100">{d.title}</p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-200/80">{d.loc}</p>
                      </div>

                      {/* Example badge */}
                      <div className="absolute left-3 top-3 inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200 backdrop-blur">
                        Example
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-emerald-300">{d.rent}</p>
                        <p className="text-xs text-slate-400">
                          {d.beds} bd · {d.baths} ba
                        </p>
                      </div>

                      <div className="mt-3 inline-flex items-center text-xs font-medium text-emerald-300">
                        Preview only →
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-[10px] text-slate-500">
              Note: Example listings above are demos for presentation. Real listings are published by
              individual landlords. RentZentro is software — not a property management company.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
