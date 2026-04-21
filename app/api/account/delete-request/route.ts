// app/api/account/delete-request/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { submitDeleteRequest } from './deleteRequestFlow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  landlordId?: number;
  reason?: string | null;
};
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@rentzentro.com';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'support@rentzentro.com';

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    : null;
const supabaseAuth =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const result = await submitDeleteRequest({
      supabaseAdmin,
      supabaseAuth,
      authHeader: req.headers.get('authorization') || '',
      resendApiKey: RESEND_API_KEY,
      supportEmail: SUPPORT_EMAIL,
      fromEmail: FROM_EMAIL,
      reason: body.reason,
      landlordId: body.landlordId,
      fetchImpl: fetch,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (err: any) {
    console.error('Delete request API error:', err);
    return NextResponse.json(
      { error: 'Unexpected error submitting deletion request.' },
      { status: 500 }
    );
  }
}
