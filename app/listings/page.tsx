// app/listings/page.tsx
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Browse Rentals | RentZentro',
  description:
    'Browse published rental listings on RentZentro. View photos, details, and send an inquiry to the landlord.',
  alternates: { canonical: '/listings' },
  robots: { index: true, follow: true },
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  { auth: { persistSession: false } }
);

type Listing = {
  id: number;
  title: string;
  slug: string;
  published: boolean;
  status: string | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  rent_amount: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  available_date: string | null;
  hide_exact_address: boolean;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
};

type PhotoRow = {
  id: number;
  listing_id: number;
  image_url: string;
  sort_order: number;
};

const money = (v: number | null | undefined) =>
  v == null || isNaN(v) ? null : `$${v.toLocaleString('en-US')}`;

const fmtDate = (value: string | null | undefined) => {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

async function getPublishedListings() {
  const { data, error } = await supabase
    .from('listings')
    .select(
      `
      id, title, slug, published, status,
      city, state, neighborhood,
      rent_amount, beds, baths, sqft, available_date,
      hide_exact_address, address_line1, address_line2, postal_code
    `
    )
    .eq('published', true)
    .order('published_at', { ascending: false });

  if (error) throw error;
  return (data || []) as Listing[];
}

async function getCoverPhotos(listingIds: number[]) {
  if (listingIds.length === 0) return new Map<number, PhotoRow>();

  const { data, error } = await supabase
    .from('listing_photos')
    .select('id, listing_id, image_url, sort_order')
    .in('listing_id', listingIds)
    .order('sort_order', { ascending: true });

  if (error) throw error;

  // First photo per listing_id = cover
  const cover = new Map<number, PhotoRow>();
  for (const row of (data || []) as PhotoRow[]) {
    if (!cover.has(row.listing_id)) cover.set(row.listing_id, row);
  }
  return cover;
}

export default async function PublicListingsIndexPage() {
  const listings = await getPublishedListings();
  const coverMap = await getCoverPhotos(listings.map((l) => l.id));

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Top bar */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Public Listings • Powered by{' '}
            <span className="text-emerald-300 font-semibold">RentZentro</span>
          </div>
          <Link
            href="/"
            className="text-[11px] rounded-full border border-slate-700 bg-slate-900 px-3 py-2 hover:bg-slate-800"
          >
            RentZentro Home
          </Link>
        </div>

        {/* Hero */}
        <div className="mb-6 rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
          <h1 className="text-2xl font-semibold">Browse Rentals</h1>
          <p className="mt-2 text-sm text-slate-300">
            These are <span className="text-slate-50 font-semibold">published</span> listings. Open
            one to view details, photos, and send an inquiry.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                How it works
              </p>
              <ol className="mt-2 space-y-1 text-sm text-slate-200">
                <li>
                  <span className="text-slate-500">1.</span> Click a listing to view photos + info
                </li>
                <li>
                  <span className="text-slate-500">2.</span> Use the inquiry form to contact the
                  landlord
                </li>
                <li>
                  <span className="text-slate-500">3.</span> Schedule a showing / next steps directly
                </li>
              </ol>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Listing tips
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-200">
                <li>• Add 6–12 photos (cover photo should be your best “wow” shot)</li>
                <li>• Include neighborhood + key features (parking, laundry, pets)</li>
                <li>• If you hide the address, the page shows area-only until a showing is set</li>
              </ul>
              <p className="mt-3 text-[11px] text-slate-500">
                Landlord? Create/manage listings from your dashboard.
              </p>
              <Link
                href="/landlord/listings"
                className="mt-3 inline-flex rounded-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15"
              >
                Go to landlord listings
              </Link>
            </div>
          </div>
        </div>

        {/* Grid */}
        {listings.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-8 text-center">
            <p className="text-sm font-semibold text-slate-100">No public listings yet</p>
            <p className="mt-2 text-sm text-slate-400">
              When landlords publish listings, they’ll show up here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => {
              const cover = coverMap.get(l.id);
              const price = money(l.rent_amount);
              const loc = [l.neighborhood, l.city, l.state].filter(Boolean).join(', ');
              const available = fmtDate(l.available_date) || 'Now';

              const addressLine = l.hide_exact_address
                ? [l.neighborhood, l.city, l.state].filter(Boolean).join(', ')
                : [l.address_line1, l.address_line2, l.city, l.state, l.postal_code]
                    .filter(Boolean)
                    .join(', ');

              return (
                <Link
                  key={l.id}
                  href={`/listings/${l.slug}`}
                  className="group overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900/55 transition-colors"
                >
                  <div className="relative h-48 w-full overflow-hidden bg-slate-950/50">
                    {cover?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover.image_url}
                        alt="Listing cover"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                        No cover photo
                      </div>
                    )}

                    <div className="absolute left-3 top-3 inline-flex items-center rounded-full border border-slate-700 bg-black/40 px-2.5 py-1 text-[10px] font-semibold text-slate-100 backdrop-blur">
                      {price ? `${price}/mo` : 'Price not listed'}
                    </div>
                  </div>

                  <div className="p-4">
                    <p className="text-sm font-semibold text-slate-50">{l.title}</p>
                    <p className="mt-1 text-[12px] text-slate-300">{loc || 'Location not specified'}</p>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-2">
                        <p className="text-slate-500">Beds / Baths</p>
                        <p className="mt-0.5 text-slate-100 font-semibold">
                          {(l.beds ?? '-') + ' / ' + (l.baths ?? '-')}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-2">
                        <p className="text-slate-500">Available</p>
                        <p className="mt-0.5 text-slate-100 font-semibold">{available}</p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-2">
                      <p className="text-[11px] text-slate-500">Area / Address</p>
                      <p className="mt-0.5 text-[12px] text-slate-200">
                        {addressLine || 'Not provided'}
                      </p>
                      {l.hide_exact_address && (
                        <p className="mt-1 text-[11px] text-slate-500">
                          Exact address hidden until a showing is scheduled.
                        </p>
                      )}
                    </div>

                    <div className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold text-emerald-200">
                      View listing <span className="text-emerald-300">→</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-10 text-center text-[11px] text-slate-500">
          © {new Date().getFullYear()} RentZentro
        </div>
      </div>
    </main>
  );
}
