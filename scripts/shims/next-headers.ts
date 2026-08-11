/**
 * Offline stand-in for `next/headers`. Server pages reach it through
 * `createClient()` (src/lib/supabase/server.ts), which calls `cookies()` at
 * construction — outside a Next request scope that throws. The harnesses run
 * pages' metadata/data functions against the PostgREST fake with no user
 * session, so an empty cookie jar is the honest value, not a workaround.
 */

type CookieRecord = { name: string; value: string };

export function cookies() {
  return {
    get(_name: string): CookieRecord | undefined {
      return undefined;
    },
    getAll(): CookieRecord[] {
      return [];
    },
    set(): void {
      // Server Components can't set cookies; the real store throws or no-ops.
    },
  };
}

export function headers(): Headers {
  return new Headers();
}
