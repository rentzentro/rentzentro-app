// app/listings/[slug]/page.tsx

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import PhotoGallery from './PhotoGallery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

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
      id, title, slug, published, published_at, status,
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
    : [l.address_line1, l.address_line2, l.city, l.state, l.postal_code].filter(Boolean).join(', ');

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

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Contact
                </p>
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
                      <span className="text-slate-400">Available via inquiry form</span>
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
                      <span className="text-slate-400">Available via inquiry form</span>
                    )}
                  </p>
                </div>

                <p className="mt-3 text-[11px] text-slate-500">
                  Tip: If contact isn’t shown, use the inquiry form (if enabled) or ask the landlord directly.
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
