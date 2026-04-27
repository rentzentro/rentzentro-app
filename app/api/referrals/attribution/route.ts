import { NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseAdminConfigured } from '../../../supabaseAdminClient';
import { attributeReferral } from './attributionFlow';

export async function POST(req: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: 'Supabase admin client is not configured.' },
      { status: 500 }
    );
  }

  const payload = await req.json().catch(() => ({}));

  const result = await attributeReferral({
    supabaseAdmin,
    payload,
  });

  return NextResponse.json(result.body, { status: result.status });
}
