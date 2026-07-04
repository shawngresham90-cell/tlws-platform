import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client. Uses ONLY public env vars.
 * Anon key is RLS-gated: read public rows, zero writes. All writes
 * go through server routes / Edge Functions with the service role.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
