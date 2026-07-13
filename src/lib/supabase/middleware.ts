import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the Supabase session cookie on every request (keeps the /login and
 * /auth flow's tokens fresh). It does NOT gate /admin: the admin dashboard is
 * protected by the env-var gate in its own layout (src/lib/admin/auth.ts), so
 * the middleware must let /admin and /admin/login through untouched.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // No Supabase auth cookies → nothing to refresh. Skipping the auth
  // round-trip here removes a blocking network call from every anonymous
  // public page view (perf audit #2); signed-in flows are unaffected.
  if (!request.cookies.getAll().some(({ name }) => name.startsWith('sb-'))) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Revalidate/refresh the Supabase session (side effect: refreshed auth
  // cookies via setAll). /admin is intentionally not gated here.
  await supabase.auth.getUser();

  return response;
}
