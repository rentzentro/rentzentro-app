// app/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from './lib/supabaseEnv';

type BrowserSupabaseClient = SupabaseClient<any, 'public', any>;

let cachedClient: BrowserSupabaseClient | null = null;

function getMissingSupabaseEnvReason(): string | null {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    return 'Missing Supabase client env vars. Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY).';
  }

  return null;
}

export function isSupabaseBrowserConfigured(): boolean {
  return getMissingSupabaseEnvReason() === null;
}

export function getSupabaseBrowserClient(): BrowserSupabaseClient {
  if (cachedClient) return cachedClient;

  const missingReason = getMissingSupabaseEnvReason();
  if (missingReason) {
    throw new Error(`Supabase browser client is not configured: ${missingReason}`);
  }

  cachedClient = createClient(
    getSupabaseUrl() as string,
    getSupabaseAnonKey() as string,
  );
  return cachedClient;
}

export const supabase = new Proxy({} as BrowserSupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseBrowserClient();
    const value = Reflect.get(client as unknown as object, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
}) as BrowserSupabaseClient;
