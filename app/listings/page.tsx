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
          <h1 className="text-2xl font-semibold tracking-tight">
            Available rentals
          </h1>
          <p className="mt-1 text-sm text-slate-400 max-w-2xl">
            Browse listings managed through RentZentro.  
            Each property is published directly by its landlord and kept up to date in real time.
          </p>
        </div>

        {/* Listings */}
        {hasListings ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => {
              const photos = (l.listing_photos || []).sort(
                (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
              );
              const coverUrl = photos[0]?.image_url ?? null;

              const loc =
                l.neighborhood ||
                (l.city && l.state ? `${l.city}, ${l.state}` : null);

              return (
                <Link
                  key={l.id}
                  href={`/listings/${l.slug}`}
                  className="group"
                >
                  <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70 hover:border-emerald-500/40 transition">
                    {/* Image */}
                    <div className="relative h-40 bg-slate-900 flex items-center justify-center">
                      {coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={coverUrl}
                          alt={l.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                          Listing preview
                        </div>
                      )}

                      {/* Overlay */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                        <p className="text-sm font-semibold text-slate-100 truncate">
                          {l.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-200/80 truncate">
                          {loc || 'Neighborhood available upon inquiry'}
                        </p>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-emerald-300 font-semibold text-sm">
                          {money(l.rent_amount)
                            ? `$${money(l.rent_amount)}/mo`
                            : 'Rent on request'}
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
          /* Intentional empty state (NOT "no listings") */
          <div className="mt-10 max-w-xl rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
            <p className="text-sm font-semibold text-slate-200">
              Listings update frequently
            </p>
            <p className="mt-1 text-sm text-slate-400">
              New rentals are added as landlords publish availability.
              Check back soon or ask your landlord if they manage properties through RentZentro.
            </p>
            <div className="mt-4">
              <Link
                href="/landlord/signup"
                className="inline-flex rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
              >
                I’m a landlord →
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
