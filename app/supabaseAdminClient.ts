// supabaseAdminClient.ts
import { createClient } from '@supabase/supabase-js';

// IMPORTANT:
// - This file is for SERVER-SIDE USE ONLY (API routes, webhooks, etc).
// - It uses the service role key, which must NEVER be exposed to the browser.

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export { supabaseAdmin };
