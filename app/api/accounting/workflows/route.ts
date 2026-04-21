import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from '../../../lib/supabaseEnv';
import { createAccountingWorkflow } from './accountingFlow';

const SUPABASE_URL = getSupabaseUrl() as string;
const SERVICE_ROLE_KEY = getSupabaseServiceRoleKey() as string;
const SUPABASE_ANON_KEY = getSupabaseAnonKey() as string;

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    : null;

const supabaseAuth =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const result = await createAccountingWorkflow({
    supabaseAdmin,
    supabaseAuth,
    authHeader: req.headers.get('authorization') || '',
    payload: body,
  });

  return NextResponse.json(result.body, { status: result.status });
}
