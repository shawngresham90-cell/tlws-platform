import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * SERVER-ONLY service-role client. Bypasses RLS — used exclusively inside
 * route handlers / server actions to perform the writes anon is forbidden from.
 * NEVER import this into a client component. The service role key must never
 * reach the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase admin client missing URL or SERVICE_ROLE key (server env).');
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
