import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import {
  NAVIGATOR_ACCOUNT_PATH,
  PILOT_ACCESS_PATH,
  PILOT_COOKIE_NAME,
  isNavigatorApiPath,
  navigatorFlagEnabled,
  pilotConfigured,
  verifyPilotToken,
} from '@/lib/navigator-api/pilot-access';
import {
  ACCESS_MODE_ENV_VAR,
  navigatorAccessDecision,
  parseAccessMode,
} from '@/lib/navigator-api/access-policy';

/**
 * Navigator access gate. Turns away a visitor who may not be here, no matter
 * how they arrived — a typed /drive URL, a bookmark, or a shared link.
 *
 * Returns null when the request is none of its business, which is the common
 * case for every other route on the site.
 *
 * ORDERING. The session refresh now runs FIRST and hands this function its
 * verdict, rather than running after it. That is not a weakening: the refresh
 * only rotates auth cookies, it renders nothing and serves nothing, and this
 * gate still answers before the request reaches a Navigator surface. What the
 * order buys is that `getUser()` happens once per request instead of twice —
 * the refresh needs it anyway, and account mode needs the same answer.
 *
 * This layer is deliberately the CAUTIOUS one. It runs on Edge, where a
 * server-only variable is not guaranteed to be readable. It never 404s a
 * request on a `closed` reading, because a wrongly-read `closed` would take
 * down a live Navigator; that verdict belongs to the pages, which run in
 * Node, always read the setting correctly, and fail closed.
 */
async function navigatorAccessGate(
  request: NextRequest,
  signedIn: boolean,
): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;

  const decision = navigatorAccessDecision({
    pathname,
    flagEnabled: navigatorFlagEnabled(),
    mode: parseAccessMode(process.env[ACCESS_MODE_ENV_VAR]),
    pilotConfigured: pilotConfigured(),
    tokenValid: await verifyPilotToken(request.cookies.get(PILOT_COOKIE_NAME)?.value, Date.now()),
    signedIn,
    edgeDeferral: true,
  });

  if (decision !== 'challenge' && decision !== 'sign-in') return null;

  // API callers get a status code. A redirect to an HTML page would surface
  // as an unparseable response inside the driving screen's fetch.
  if (isNavigatorApiPath(pathname)) {
    return NextResponse.json(
      {
        ok: false,
        state: 'unauthorized',
        problems: [{ code: decision === 'sign-in' ? 'account-required' : 'pilot-access-required' }],
      },
      { status: 401 },
    );
  }

  const url = request.nextUrl.clone();
  url.pathname = decision === 'sign-in' ? NAVIGATOR_ACCOUNT_PATH : PILOT_ACCESS_PATH;
  url.search = '';
  url.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { response, signedIn } = await updateSession(request);
  const gated = await navigatorAccessGate(request, signedIn);
  if (!gated) return response;

  /*
   * Carry any refreshed auth cookies onto the gate's response.
   *
   * Without this a driver whose access token rotated on the same request that
   * got gated would lose the rotation: the redirect replaces the refresh
   * response, the new cookies are dropped, and the next request presents the
   * old token again. That is how a sign-in loop starts — and it would only
   * show up for someone whose token happened to expire mid-session, which is
   * the hardest kind of bug to reproduce on purpose.
   */
  for (const cookie of response.cookies.getAll()) {
    gated.cookies.set(cookie);
  }
  return gated;
}

export const config = {
  // Run on everything except static assets and images.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|fonts|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
