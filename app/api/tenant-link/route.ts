// app/api/tenant-link/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE env vars for tenant-link route');
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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
