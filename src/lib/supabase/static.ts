import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Cookieless anon client for build-time / static-generation reads
 * (generateStaticParams, sitemap). No request scope, no cookies — safe to call
 * outside a request. Only ever reads public/published rows (RLS enforces this).
 */
export function createStaticClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}
