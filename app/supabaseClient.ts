// app/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

type BrowserSupabaseClient = ReturnType<typeof createClient>;

let cachedClient: BrowserSupabaseClient | null = null;

function getMissingSupabaseEnvReason(): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return 'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required (check .env).';
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
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
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
