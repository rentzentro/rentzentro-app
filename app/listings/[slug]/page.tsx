// app/listings/[slug]/page.tsx
import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import Link from 'next/link';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://www.rentzentro.com';

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
  deposit_amount: number | null;
  available_date: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  description: string | null;
  hide_exact_address: boolean;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

type Photo = {
  id: number;
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
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const absoluteUrl = (pathOrUrl: string) => {
  if (!pathOrUrl) return SITE_URL;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_URL.replace(/\/$/, '')}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
};

async function getListing(slug: string) {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();

  if (error) throw error;
  return data as Listing | null;
}

async function getPhotos(listingId: number) {
  const { data, error } = await supabase
    .from('listing_photos')
    .select('id, image_url, sort_order')
    .eq('listing_id', listingId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data || []) as Photo[];
}

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const listing = await getListing(params.slug);

  if (!listing) {
    return {
      title: 'Listing not found | RentZentro',
      robots: { index: false, follow: false },
    };
  }

  // Pull first photo for OG/Twitter previews
  let ogImage: string | undefined;
  try {
    const photos = await getPhotos(listing.id);
    const first = photos?.[0]?.image_url;
    if (first) ogImage = absoluteUrl(first);
  } catch {
    // ignore photo errors in metadata
  }

  const locParts = [listing.neighborhood, listing.city, listing.state].filter(Boolean).join(', ');
  const price = money(listing.rent_amount);
  const beds = listing.beds != null ? `${listing.beds} bed` : null;
  const baths = listing.baths != null ? `${listing.baths} bath` : null;

  const titleBits = [
    listing.title,
    price ? `${price}/mo` : null,
    beds,
    baths,
    locParts || null,
  ].filter(Boolean);

  const title = `${titleBits.join(' • ')} | RentZentro`;

  const descBits = [
    price ? `Rent: ${price}/mo.` : null,
    listing.deposit_amount ? `Deposit: ${money(listing.deposit_amount)}.` : null,
    beds || null,
    baths || null,
    listing.sqft ? `${listing.sqft.toLocaleString('en-US')} sqft.` : null,
    locParts ? `Location: ${locParts}.` : null,
  ].filter(Boolean);

  const description =
    (listing.description && listing.description.slice(0, 180)) ||
    descBits.join(' ') ||
    'View rental details and contact the landlord.';

  const canonicalPath = `/listings/${listing.slug}`;
  const canonical = absoluteUrl(canonicalPath);

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function PublicListingPage({
  params,
}: {
  params: { slug: string };
}) {
  const listing = await getListing(params.slug);

  if (!listing) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h1 className="text-lg font-semibold">Listing not found</h1>
          <p className="mt-2 text-sm text-slate-300">
            This listing may have been unpublished or the link is incorrect.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs text-slate-200 hover:bg-slate-800"
          >
            Back to RentZentro
          </Link>
        </div>
      </main>
    );
  }

  const photos = await getPhotos(listing.id);

  const loc = [listing.neighborhood, listing.city, listing.state].filter(Boolean).join(', ');
  const price = money(listing.rent_amount);
  const deposit = money(listing.deposit_amount);
  const available = fmtDate(listing.available_date);

  const addressLine =
    listing.hide_exact_address
      ? [listing.neighborhood, listing.city, listing.state].filter(Boolean).join(', ')
      : [listing.address_line1, listing.address_line2, listing.city, listing.state, listing.postal_code]
          .filter(Boolean)
          .join(', ');

  const canonical = absoluteUrl(`/listings/${listing.slug}`);

  // Simple SEO boost: structured data
  const ldJson: any = {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    url: canonical,
    availability: 'https://schema.org/InStock',
    price: listing.rent_amount ?? undefined,
    priceCurrency: listing.rent_amount != null ? 'USD' : undefined,
    itemOffered: {
      '@type': 'Apartment',
      name: listing.title,
      description: listing.description || undefined,
      numberOfRooms: listing.beds ?? undefined,
      floorSize: listing.sqft ? { '@type': 'QuantitativeValue', value: listing.sqft, unitCode: 'FTK' } : undefined,
      address: {
        '@type': 'PostalAddress',
        addressLocality: listing.city || undefined,
        addressRegion: listing.state || undefined,
        postalCode: listing.postal_code || undefined,
        streetAddress: listing.hide_exact_address ? undefined : [listing.address_line1, listing.address_line2].filter(Boolean).join(', ') || undefined,
      },
    },
  };

  // IMPORTANT: make sure this matches your actual API route file.
  // If your working route is app/api/listings/inquiry/route.ts => keep "/api/listings/inquiry"
  // If your working route is app/api/listing-inquiry/route.ts => change to "/api/listing-inquiry"
  const inquiryAction = '/api/listings/inquiry';

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }}
        />

        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Public Listing • Powered by{' '}
            <span className="text-emerald-300 font-semibold">RentZentro</span>
          </div>
          <Link
            href="/"
            className="text-[11px] rounded-full border border-slate-700 bg-slate-900 px-3 py-2 hover:bg-slate-800"
          >
            RentZentro Home
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          {/* Left */}
          <section className="space-y-4">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
              <h1 className="text-xl font-semibold text-slate-50">{listing.title}</h1>
              <p className="mt-2 text-sm text-slate-300">{loc || 'Location not specified'}</p>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-slate-400">Rent</p>
                  <p className="mt-1 text-slate-50 font-semibold">{price ? `${price}/mo` : '-'}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-slate-400">Deposit</p>
                  <p className="mt-1 text-slate-50 font-semibold">{deposit || '-'}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-slate-400">Beds / Baths</p>
                  <p className="mt-1 text-slate-50 font-semibold">
                    {(listing.beds ?? '-') + ' / ' + (listing.baths ?? '-')}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-slate-400">Available</p>
                  <p className="mt-1 text-slate-50 font-semibold">{available || 'Now'}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
                <p className="text-[11px] text-slate-400">Address</p>
                <p className="mt-1 text-sm text-slate-200">{addressLine || '-'}</p>
                {listing.hide_exact_address && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Exact address hidden until a showing is scheduled.
                  </p>
                )}
              </div>
            </div>

            {/* Photos */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Photos
              </p>

              {photos.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">No photos uploaded yet.</p>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {photos.map((ph) => (
                    <div
                      key={ph.id}
                      className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ph.image_url}
                        alt={`${listing.title} photo`}
                        className="h-56 w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Description
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-200">
                {listing.description || 'No description provided.'}
              </p>
            </div>
          </section>

          {/* Right: Inquiry form */}
          <aside className="h-fit rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Contact / Inquire
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Send a message to the landlord. You’ll get a reply using the contact info provided.
            </p>

            <form action={inquiryAction} method="POST" className="mt-4 space-y-3">
              <input type="hidden" name="listing_id" value={String(listing.id)} />

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Name</label>
                <input
                  name="name"
                  required
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-500/70"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Email</label>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-500/70"
                  placeholder="you@email.com"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Phone (optional)</label>
                <input
                  name="phone"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-500/70"
                  placeholder="(555) 555-5555"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Message</label>
                <textarea
                  name="message"
                  required
                  rows={5}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-500/70"
                  placeholder="Hi! I’m interested in this unit. When is the earliest showing available?"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Send inquiry
              </button>

              <p className="text-[11px] text-slate-500">
                By submitting, you agree to be contacted about this rental.
              </p>
            </form>

            {(listing.contact_email || listing.contact_phone) && (
              <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
                <p className="text-[11px] text-slate-400">Landlord contact (if provided)</p>
                <div className="mt-1 space-y-1 text-sm text-slate-200">
                  {listing.contact_email && <p>Email: {listing.contact_email}</p>}
                  {listing.contact_phone && <p>Phone: {listing.contact_phone}</p>}
                </div>
              </div>
            )}
          </aside>
        </div>

        <div className="mt-10 text-center text-[11px] text-slate-500">
          © {new Date().getFullYear()} RentZentro
        </div>
      </div>
    </main>
  );
}
