import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const listingIdRaw = form.get('listing_id');
    const name = String(form.get('name') || '').trim();
    const email = String(form.get('email') || '').trim();
    const phone = String(form.get('phone') || '').trim();
    const message = String(form.get('message') || '').trim();

    const listing_id = Number(listingIdRaw);

    if (!listing_id || Number.isNaN(listing_id)) {
      return NextResponse.json({ error: 'Invalid listing id.' }, { status: 400 });
    }
    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    // Make sure listing exists + is published, and fetch owner + slug for redirect
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, owner_id, slug, published')
      .eq('id', listing_id)
      .maybeSingle();

    if (listingError) throw listingError;

    if (!listing || listing.published !== true) {
      return NextResponse.json({ error: 'Listing not available.' }, { status: 404 });
    }

    const { error: insertError } = await supabase.from('listing_inquiries').insert({
      listing_id: listing.id,
      owner_id: listing.owner_id,
      name,
      email,
      phone: phone || null,
      message,
      status: 'new',
    });

    if (insertError) throw insertError;

    // Redirect back to the listing with a success flag (premium UX)
    const url = new URL(`/listings/${listing.slug}?sent=1`, req.url);
    return NextResponse.redirect(url, 303);
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message || 'Failed to send inquiry.' },
      { status: 500 }
    );
  }
}
