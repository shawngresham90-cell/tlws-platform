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

/**
 * The service-role client with fetch caching switched off, for asking about the
 * SHAPE of the schema rather than its contents.
 *
 * See createUncachedStaticClient in ../supabase/static.ts for the full reason.
 * Short version: Next caches `fetch` GETs, that cache outlives deploys, and a
 * cached answer to "does this column exist" is a lie waiting for a migration.
 * On the admin side the consequence is narrower than an outage but worse
 * commercially — an activation offered against a column that is not there.
 */
export function createUncachedAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase admin client missing URL or SERVICE_ROLE key (server env).');
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: 'no-store' }),
    },
  });
}
