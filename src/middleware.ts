import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import {
  PILOT_ACCESS_PATH,
  PILOT_COOKIE_NAME,
  isNavigatorApiPath,
  navigatorFlagEnabled,
  navigatorGateDecision,
  pilotConfigured,
  verifyPilotToken,
} from '@/lib/navigator-api/pilot-access';

/**
 * Navigator pilot gate. Runs before the Supabase session refresh so an
 * unauthorized visitor never reaches a Navigator surface, no matter how they
 * arrived — a typed /drive URL, a bookmark, or a shared link.
 *
 * Returns null when the request is none of its business, which is the common
 * case for every other route on the site.
 */
async function navigatorPilotGate(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;

  const decision = navigatorGateDecision({
    pathname,
    flagEnabled: navigatorFlagEnabled(),
    configured: pilotConfigured(),
    tokenValid: await verifyPilotToken(request.cookies.get(PILOT_COOKIE_NAME)?.value, Date.now()),
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
  const gated = await navigatorPilotGate(request);
  if (gated) return gated;
  return await updateSession(request);
}

export const config = {
  // Run on everything except static assets and images.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|fonts|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
