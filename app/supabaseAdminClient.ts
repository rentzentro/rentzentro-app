// supabaseAdminClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from './lib/supabaseEnv';

// IMPORTANT:
// - This file is for SERVER-SIDE USE ONLY (API routes, webhooks, etc).
// - It uses the service role key, which must NEVER be exposed to the browser.

let cachedClient: SupabaseClient | null = null;

function getMissingSupabaseAdminEnvReason(): string | null {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    return 'Missing Supabase admin env vars. Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.';
  }

  return null;
}

function getSupabaseAdminClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const missingReason = getMissingSupabaseAdminEnvReason();
  if (missingReason) {
    throw new Error(missingReason);
  }

  const supabaseUrl = getSupabaseUrl() as string;
  const serviceRoleKey = getSupabaseServiceRoleKey() as string;
  cachedClient = createClient(supabaseUrl, serviceRoleKey);
  return cachedClient;
}

export function isSupabaseAdminConfigured(): boolean {
  return getMissingSupabaseAdminEnvReason() === null;
}

// Keep existing import style (`import { supabaseAdmin } ...`) while deferring
// env access/client creation until first real usage at request time.
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseAdminClient();
    const value = Reflect.get(client as unknown as object, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
}) as SupabaseClient;

export { getSupabaseAdminClient };
