// app/api/listings/inquiry/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  {
    auth: { persistSession: false },
  }
);

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const listing_id = Number(form.get('listing_id') || 0);
    const name = String(form.get('name') || '').trim();
    const email = String(form.get('email') || '').trim();
    const phone = String(form.get('phone') || '').trim() || null;
    const message = String(form.get('message') || '').trim();

    if (!listing_id || !name || !email || !message) {
      return NextResponse.json(
        { error: 'Missing required fields.' },
        { status: 400 }
      );
    }

    // Fetch listing to get owner_id AND confirm it is published
    const { data: listing, error: listingErr } = await supabase
      .from('listings')
      .select('id, owner_id, published, slug')
      .eq('id', listing_id)
      .maybeSingle();

    if (listingErr) throw listingErr;

    if (!listing || listing.published !== true) {
      return NextResponse.json(
        { error: 'Listing not found or not published.' },
        { status: 404 }
      );
    }

    // Insert inquiry (RLS allows anon insert ONLY if listing is published)
    const { error: insErr } = await supabase.from('listing_inquiries').insert({
      listing_id,
      owner_id: listing.owner_id,
      name,
      email,
      phone,
      message,
      status: 'new',
    });

    if (insErr) {
      console.error('Inquiry insert error:', insErr);
      return NextResponse.json(
        { error: 'Failed to submit inquiry.' },
        { status: 500 }
      );
    }

    // Redirect back to the listing with a simple success flag
    return NextResponse.redirect(
      new URL(`/listings/${listing.slug}?sent=1`, req.url)
    );
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message || 'Server error' },
      { status: 500 }
    );
  }
}
