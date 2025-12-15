import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // Ensure authenticated for landlord actions
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    const user = authData.user;
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    if (action === 'create') {
      const payload = body?.payload || {};

      // basic guard
      if (!payload?.title || !payload?.slug) {
        return NextResponse.json({ error: 'Missing title/slug.' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('listings')
        .insert(payload)
        .select('*')
        .maybeSingle();

      if (error) throw error;

      return NextResponse.json({ ok: true, listing: data });
    }

    if (action === 'publish' || action === 'unpublish') {
      const listingId = Number(body?.listingId);
      if (!listingId) {
        return NextResponse.json({ error: 'Missing listingId.' }, { status: 400 });
      }

      const publish = action === 'publish';

      const { data, error } = await supabase
        .from('listings')
        .update({
          published: publish,
          published_at: publish ? new Date().toISOString() : null,
        })
        .eq('id', listingId)
        .select('*')
        .maybeSingle();

      if (error) throw error;

      return NextResponse.json({ ok: true, listing: data });
    }

    if (action === 'inquiry_status') {
      const inquiryId = Number(body?.inquiryId);
      const status = String(body?.status || '').trim();
      if (!inquiryId || !status) {
        return NextResponse.json({ error: 'Missing inquiryId/status.' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('listing_inquiries')
        .update({ status })
        .eq('id', inquiryId)
        .select('*')
        .maybeSingle();

      if (error) throw error;

      return NextResponse.json({ ok: true, inquiry: data });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err: any) {
    console.error('api/listings error', err);
    return NextResponse.json(
      { error: err?.message || 'Server error.' },
      { status: 500 }
    );
  }
}
