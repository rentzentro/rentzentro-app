// app/listings/[slug]/page.tsx

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import PhotoGallery from './PhotoGallery';
import ListingInquiryForm from './ListingInquiryForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  { auth: { persistSession: false } }
);

type Listing = {
  id: number;
  owner_id: string;
  title: string;
  slug: string;
  published: boolean;
  published_at: string | null;
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

const money = (n: number | null | undefined) =>
  n == null || isNaN(n)
    ? null
    : n.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      });

const fmtDate = (value: string | null | undefined) => {
  if (!value) return null;

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

function safeText(input: string | null | undefined) {
  return (input || '').replace(/\s+/g, ' ').trim();
}

function buildListingMeta(l: Listing, coverUrl: string | null): Metadata {
  const loc = [l.neighborhood, l.city, l.state].filter(Boolean).join(', ');
  const price = money(l.rent_amount);
  const bedsBaths =
    l.beds != null || l.baths != null ? `${l.beds ?? '—'} bd · ${l.baths ?? '—'} ba` : '';
  const titleBits = [safeText(l.title), loc ? `— ${loc}` : '', price ? `— ${price}/mo` : '']
    .filter(Boolean)
    .join(' ');

  const desc =
    safeText(l.description) ||
    `View details for ${safeText(l.title)}${loc ? ` in ${loc}` : ''}.`;

  const url = `https://www.rentzentro.com/listings/${l.slug}`;

  return {
    title: titleBits || l.title,
    description: desc.slice(0, 160),
    alternates: { canonical: url },
    openGraph: {
      title: titleBits || l.title,
      description: desc.slice(0, 200),
      url,
      siteName: 'RentZentro',
      type: 'article',
      images: coverUrl ? [{ url: coverUrl }] : undefined,
    },
    twitter: {
      card: coverUrl ? 'summary_large_image' : 'summary',
      title: titleBits || l.title,
      description: desc.slice(0, 200),
      images: coverUrl ? [coverUrl] : undefined,
    },
    robots: {
      index: true,
      follow: true,
    },
    keywords: [
      'rentals',
      'apartments',
      'houses for rent',
      'rent listing',
      'RentZentro',
      loc || '',
      bedsBaths || '',
    ].filter(Boolean),
  };
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const slug = (params?.slug || '').trim();
  if (!slug) return {};

  const { data: listing } = await supabase
    .from('listings')
    .select(
      `
      id, owner_id, title, slug, published, published_at, status,
      city, state, neighborhood,
      rent_amount, deposit_amount, available_date,
      beds, baths, sqft,
      description,
      hide_exact_address, address_line1, address_line2, postal_code,
      contact_email, contact_phone
    `
    )
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();

  if (!listing) return {};

  const l = listing as Listing;

  const { data: photosData } = await supabase
    .from('listing_photos')
    .select('image_url, sort_order')
    .eq('listing_id', l.id)
    .order('sort_order', { ascending: true })
    .limit(1);

  const coverUrl = (photosData && photosData[0]?.image_url) || null;

  return buildListingMeta(l, coverUrl);
}

export default async function ListingDetailsPage({
  params,
}: {
  params: { slug: string };
}) {
  const slug = (params?.slug || '').trim();
  if (!slug) notFound();

  const { data: listing, error: listingErr } = await supabase
    .from('listings')
    .select(
      `
      id, owner_id, title, slug, published, published_at, status,
      city, state, neighborhood,
      rent_amount, deposit_amount, available_date,
      beds, baths, sqft,
      description,
      hide_exact_address, address_line1, address_line2, postal_code,
      contact_email, contact_phone
    `
    )
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();

  if (listingErr || !listing) notFound();

  const l = listing as Listing;

  const { data: photosData } = await supabase
    .from('listing_photos')
    .select('id, image_url, sort_order')
    .eq('listing_id', l.id)
    .order('sort_order', { ascending: true });

  const photos = (photosData || []) as Photo[];

  const loc = [l.neighborhood, l.city, l.state].filter(Boolean).join(', ');
  const price = money(l.rent_amount);
  const deposit = money(l.deposit_amount);
  const available = fmtDate(l.available_date) || 'Now';

  const addressLine = l.hide_exact_address
    ? [l.neighborhood, l.city, l.state].filter(Boolean).join(', ')
    : [l.address_line1, l.address_line2, l.city, l.state, l.postal_code]
        .filter(Boolean)
        .join(', ');

  const showDirectContact = !!(l.contact_email || l.contact_phone);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex gap-2">
            <Link href="/" className="hover:text-emerald-400">
              Home
            </Link>
            <span>/</span>
            <Link href="/listings" className="hover:text-emerald-400">
              Listings
            </Link>
            <span>/</span>
            <span className="text-slate-300 truncate max-w-[50vw]">{l.title}</span>
          </div>

          <Link
            href="/listings"
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            ← Back
          </Link>
        </div>

        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-50">{l.title}</h1>
              <p className="mt-1 text-sm text-slate-400">
                {loc || 'Location available upon inquiry'}
              </p>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-200">
                  {price ? `${price}/mo` : 'Rent on request'}
                </span>

                <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 font-medium text-slate-200">
                  {(l.beds ?? '—')} bd · {(l.baths ?? '—')} ba
                  {l.sqft != null ? ` · ${l.sqft.toLocaleString('en-US')} sqft` : ''}
                </span>

                <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 font-medium text-slate-200">
                  Available:{' '}
                  <span className="ml-1 text-slate-100 font-semibold">{available}</span>
                </span>

                {deposit && (
                  <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 font-medium text-slate-200">
                    Deposit: <span className="ml-1 text-slate-100 font-semibold">{deposit}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-300">
              <p className="font-semibold text-slate-200">About RentZentro</p>
              <p className="mt-1 text-slate-400">
                This listing is published by an individual landlord using RentZentro. RentZentro is
                software for managing rentals — not a property management company.
              </p>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Photos</p>
            <PhotoGallery photos={photos} />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Description
              </p>
              <p className="mt-2 text-sm text-slate-200 whitespace-pre-line">
                {l.description?.trim() || 'No description provided.'}
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Area / Address
                </p>
                <p className="mt-2 text-sm text-slate-200">{addressLine || 'Not provided'}</p>
                {l.hide_exact_address && (
                  <p className="mt-2 text-[11px] text-slate-500">
                    Exact address is hidden until a showing is scheduled.
                  </p>
                )}
              </div>

              {/* Inquiry form (1-way, goes to landlord + team) */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Send an inquiry
                </p>
                <p className="mt-2 text-[11px] text-slate-400">
                  This sends a one-way inquiry to the landlord (and any authorized team members).
                  You’ll get a reply directly from them using the contact info you provide.
                </p>

                <div className="mt-4">
                  <ListingInquiryForm listingId={l.id} listingTitle={l.title} listingSlug={l.slug} />
                </div>

                {showDirectContact && (
                  <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                    <p className="text-[11px] font-semibold text-slate-200">Direct contact (optional)</p>
                    <div className="mt-2 space-y-1 text-sm">
                      <p className="text-slate-200">
                        Email:{' '}
                        {l.contact_email ? (
                          <a
                            className="text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
                            href={`mailto:${l.contact_email}`}
                          >
                            {l.contact_email}
                          </a>
                        ) : (
                          <span className="text-slate-500">Not provided</span>
                        )}
                      </p>
                      <p className="text-slate-200">
                        Phone:{' '}
                        {l.contact_phone ? (
                          <a
                            className="text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
                            href={`tel:${l.contact_phone}`}
                          >
                            {l.contact_phone}
                          </a>
                        ) : (
                          <span className="text-slate-500">Not provided</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                <p className="mt-3 text-[11px] text-slate-500">
                  Safety tip: Never send sensitive info (SSN, bank details, etc.) in an inquiry.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="h-10" />
      </div>
    </main>
  );
}
