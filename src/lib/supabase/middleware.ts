import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the Supabase session cookie on every request (keeps the /login and
 * /auth flow's tokens fresh). It does NOT gate /admin: the admin dashboard is
 * protected by the env-var gate in its own layout (src/lib/admin/auth.ts), so
 * the middleware must let /admin and /admin/login through untouched.
 *
 * Returns the refreshed response AND whether the request carries a verified
 * user. The verdict is a by-product: `getUser()` already runs here on every
 * request, and the Navigator's account gate needs exactly that answer. Making
 * it a return value rather than calling `getUser()` a second time in the gate
 * saves a network round-trip per request — which matters on a phone in a
 * truck, where the request is on cellular and the page is a driving screen.
 *
 * `signedIn` is false when Supabase is unreachable, not an error. A gate that
 * throws on a network blip takes the page down for signed-in drivers too;
 * failing closed here degrades to "please sign in", which recovers on its own.
 */
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  signedIn: boolean;
}> {
  let response = NextResponse.next({ request });

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
  let signedIn = false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
  } catch {
    signedIn = false;
  }

  return { response, signedIn };
}
