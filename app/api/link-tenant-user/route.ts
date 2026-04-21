// app/api/link-tenant-user/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const { email, userId, tenantName } = body as {
      email?: string;
      userId?: string;
      tenantName?: string;
    };

    if (!email || !userId) {
      return NextResponse.json(
        { error: 'Missing email or userId in request body.' },
        { status: 400 }
      );
    }

    // Link the auth user to the tenant row by email,
    // but ONLY where user_id is currently null.
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .update({
        user_id: userId,
        ...(tenantName ? { name: tenantName } : {}),
      })
      .eq('email', email)
      .is('user_id', null)
      .select('id, owner_id');

    if (error) {
      console.error('link-tenant-user update error:', error);
      return NextResponse.json(
        { error: 'Failed to link tenant to user.' },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      // No row matched (already linked or email mismatch) – not fatal
      console.log(
        'link-tenant-user: no tenant row updated for email:',
        email
      );
      return NextResponse.json(
        { ok: true, linked: false },
        { status: 200 }
      );
    }

    const linkedTenant = data[0];

    // Best-effort backfill for historical messages that may have tenant_user_id null.
    // This lets tenant users see landlord/team messages immediately after linking.
    try {
      await supabaseAdmin
        .from('messages')
        .update({ tenant_user_id: userId })
        .eq('tenant_id', linkedTenant.id)
        .is('tenant_user_id', null);
    } catch (backfillError) {
      console.error(
        'link-tenant-user: message tenant_user_id backfill error:',
        backfillError
      );
    }

    console.log('link-tenant-user: linked tenant id', linkedTenant.id, 'to user', userId);

    return NextResponse.json(
      { ok: true, linked: true, tenantId: linkedTenant.id },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('link-tenant-user unexpected error:', error);
    return NextResponse.json(
      {
        error:
          error?.message || 'Unexpected error while linking tenant user.',
      },
      { status: 500 }
    );
  }
}
