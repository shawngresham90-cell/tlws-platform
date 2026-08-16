import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import {
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
 * Navigator access gate. Runs before the Supabase session refresh so a
 * visitor who may not be here never reaches a Navigator surface, no matter
 * how they arrived — a typed /drive URL, a bookmark, or a shared link.
 *
 * Returns null when the request is none of its business, which is the common
 * case for every other route on the site.
 *
 * This layer is deliberately the CAUTIOUS one. It runs on Edge, where a
 * server-only variable is not guaranteed to be readable. It acts on two
 * things: a `public` reading (let them through — the Node layer would have
 * too) and the existing pilot challenge. It never 404s a request on a
 * `closed` reading, because a wrongly-read `closed` would take down a live
 * Navigator; that verdict belongs to the pages, which run in Node, always
 * read the setting correctly, and fail closed.
 */
async function navigatorAccessGate(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;

  const decision = navigatorAccessDecision({
    pathname,
    flagEnabled: navigatorFlagEnabled(),
    mode: parseAccessMode(process.env[ACCESS_MODE_ENV_VAR]),
    pilotConfigured: pilotConfigured(),
    tokenValid: await verifyPilotToken(request.cookies.get(PILOT_COOKIE_NAME)?.value, Date.now()),
    edgeDeferral: true,
  });

  if (decision !== 'challenge') return null;

  // API callers get a status code. A redirect to an HTML page would surface
  // as an unparseable response inside the driving screen's fetch.
  if (isNavigatorApiPath(pathname)) {
    return NextResponse.json(
      { ok: false, state: 'unauthorized', problems: [{ code: 'pilot-access-required' }] },
      { status: 401 },
    );
  }

  const url = request.nextUrl.clone();
  url.pathname = PILOT_ACCESS_PATH;
  url.search = '';
  url.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const gated = await navigatorAccessGate(request);
  if (gated) return gated;
  return await updateSession(request);
}

export const config = {
  // Run on everything except static assets and images.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|fonts|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
