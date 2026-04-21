// supabaseAdminClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// IMPORTANT:
// - This file is for SERVER-SIDE USE ONLY (API routes, webhooks, etc).
// - It uses the service role key, which must NEVER be exposed to the browser.

let cachedClient: SupabaseClient | null = null;

function getMissingSupabaseAdminEnvReason(): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.';
  }

  return null;
}

function getSupabaseAdminClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const missingReason = getMissingSupabaseAdminEnvReason();
  if (missingReason) {
    throw new Error(missingReason);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
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
