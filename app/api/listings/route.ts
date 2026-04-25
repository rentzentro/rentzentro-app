import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from '../../lib/supabaseEnv';
import { trackProductEvent } from '../../lib/productEventTracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = getSupabaseUrl() as string;
const supabaseAnonKey = getSupabaseAnonKey() as string;
const supabaseServiceRoleKey = getSupabaseServiceRoleKey() as string;

const supabaseAuth =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;


export async function POST(req: Request) {
  try {
    if (!supabaseAuth || !supabaseAdmin) {
      return NextResponse.json(
        {
          error:
            'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY), and SUPABASE_SERVICE_ROLE_KEY.',
        },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : '';

    if (!token) {
      return NextResponse.json({ error: 'Missing bearer token.' }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
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

      const { data, error } = await supabaseAdmin
        .from('listings')
        .insert({
          ...payload,
          owner_id: user.id,
          published: false,
          published_at: null,
        })
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

      const { data, error } = await supabaseAdmin
        .from('listings')
        .update({
          published: publish,
          published_at: publish ? new Date().toISOString() : null,
        })
        .eq('id', listingId)
        .eq('owner_id', user.id)
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return NextResponse.json(
          { error: 'Listing not found or not owned by authenticated user.' },
          { status: 404 }
        );
      }

      if (publish) {
        const { count: publishedCount, error: publishedCountError } = await supabaseAdmin
          .from('listings')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', user.id)
          .eq('published', true);

        if (!publishedCountError && (publishedCount || 0) === 1) {
          await trackProductEvent(supabaseAdmin, {
            eventName: 'first_listing_published',
            landlordUserId: user.id,
            metadata: { listingId: data.id },
          });
        }
      }

      return NextResponse.json({ ok: true, listing: data });
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
