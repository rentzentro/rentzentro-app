// app/api/tenant-link/route.ts
import { NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../supabaseAdminClient';

if (!isSupabaseAdminConfigured()) {
  console.error('Missing SUPABASE env vars for tenant-link route');
}

export async function POST(req: Request) {
  try {
    const { userId, email } = await req.json();

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'Missing userId or email' },
        { status: 400 }
      );
    }

    // Link this auth user to the tenant row (only if user_id is currently null)
    const { error } = await supabaseAdmin
      .from('tenants')
      .update({ user_id: userId })
      .is('user_id', null)
      .eq('email', email);

    if (error) {
      console.error('tenant-link error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to link tenant record.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error('tenant-link unexpected error:', err);
    return NextResponse.json(
      { error: err?.message || 'Unexpected error in tenant-link.' },
      { status: 500 }
    );
  }
}
