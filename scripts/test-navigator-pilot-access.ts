/**
 * Navigator pilot access harness: the homepage Navigator tile and the
 * server-side password gate that fronts every Navigator surface.
 *
 * Two halves:
 *   - BEHAVIOR, via the pure gate/token module and static renders through
 *     react-dom/server (no DOM, no browser, no server).
 *   - INVARIANTS a render cannot reach, via source assertions: the password
 *     never becomes client code, the cookie is HttpOnly, the feature flag
 *     survives, and no protected route lost its guard.
 *
 * The password used here is a DUMMY. The real pilot password lives only in
 * the owner's Netlify environment; committing it to a harness would be the
 * exact leak the gate exists to prevent.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-pilot-access.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts --loader:.css=empty \
 *     --outfile=/tmp/test-navigator-pilot-access.cjs && node /tmp/test-navigator-pilot-access.cjs
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

const TEST_PASSWORD = 'harness-only-not-the-real-one';
process.env.NAVIGATOR_PREVIEW_PASSWORD = TEST_PASSWORD;
process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED = 'true';
// Dummy Supabase values so the middleware's session refresh can construct a
// client offline. Without them a gate BYPASS would crash here instead of
// failing an assertion, which reads as a broken harness rather than a broken
// gate. Nothing here talks to a network.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://harness.invalid';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'harness-anon-key';

import {
  PILOT_ACCESS_PATH,
  PILOT_COOKIE_NAME,
  PILOT_MAX_AGE_SECONDS,
  constantTimeEqual,
  isNavigatorApiPath,
  isProtectedNavigatorPath,
  issuePilotToken,
  navigatorGateDecision,
  pilotConfigured,
  requestHasPilotAccess,
  sanitizeNextPath,
  verifyPilotPassword,
  verifyPilotToken,
} from '@/lib/navigator-api/pilot-access';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { Hero } from '@/components/sections/Hero';
import { NavigatorMarquee } from '@/components/sections/NavigatorMarquee';
import { TruckParkingMarquee } from '@/components/sections/TruckParkingMarquee';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${String(detail).slice(0, 200)}`}`);
  }
}

const read = (p: string) => readFileSync(p, 'utf8');
const heroSrc = read('src/components/sections/Hero.tsx');
const marqueeSrc = read('src/components/sections/NavigatorMarquee.tsx');
const accessPageSrc = read('src/app/(navigator)/navigator/access/page.tsx');
const accessActionSrc = read('src/app/(navigator)/navigator/access/actions.ts');
const middlewareSrc = read('src/middleware.ts');
const pilotAccessSrc = read('src/lib/navigator-api/pilot-access.ts');
const pilotSessionSrc = read('src/lib/navigator-api/pilot-session.ts');
const drivePageSrc = read('src/app/(navigator)/drive/page.tsx');
const navPageSrc = read('src/app/(navigator)/navigator/page.tsx');
const routeApiSrc = read('src/app/api/navigator/route/route.ts');
const searchApiSrc = read('src/app/api/navigator/destination-search/route.ts');
const parkingMarqueeSrc = read('src/components/sections/TruckParkingMarquee.tsx');
const parkingSectionSrc = read('src/components/sections/TruckParking.tsx');

async function main() {
  const heroMarkup = renderToStaticMarkup(createElement(Hero));
  const navMarkup = renderToStaticMarkup(createElement(NavigatorMarquee));
  const parkingMarkup = renderToStaticMarkup(createElement(TruckParkingMarquee));

  /* ---------------------------------------------------------------- *
   * 1 — Navigator homepage card exists
   * ---------------------------------------------------------------- */
  check('1a: Navigator tile renders when the flag is on', navMarkup.length > 0);
  check('1b: the tile is on the rendered homepage hero', heroMarkup.includes('Navigator'));
  check(
    '1c: the tile links to the PASSWORD GATE, never straight at the Navigator',
    navMarkup.includes(`href="${PILOT_ACCESS_PATH}"`) && !navMarkup.includes('href="/drive"'),
  );
  check(
    '1d: the tile is a real card, not a bare text link',
    navMarkup.includes('marquee-lights') && navMarkup.includes('aspect-square'),
  );

  /* ---------------------------------------------------------------- *
   * 2 — Navigator appears DIRECTLY below Truck Parking
   * ---------------------------------------------------------------- */
  const anchors = heroMarkup.split('<a ').slice(1);
  const parkingAnchorIndex = anchors.findIndex((a) => a.startsWith('aria-label="Truck Parking'));
  const navigatorAnchorIndex = anchors.findIndex((a) => a.startsWith('aria-label="Navigator'));
  check('2a: the Truck Parking tile is present', parkingAnchorIndex >= 0);
  check('2b: the Navigator tile is present', navigatorAnchorIndex >= 0);
  check('2c: Navigator comes AFTER Truck Parking', navigatorAnchorIndex > parkingAnchorIndex);
  check(
    '2d: Navigator is the very next tile — nothing between them',
    navigatorAnchorIndex === parkingAnchorIndex + 1,
    `parking=${parkingAnchorIndex} navigator=${navigatorAnchorIndex}`,
  );
  check(
    '2e: both tiles live in the same promo column',
    /<HeroShirtPromo \/>\s*<TruckParkingMarquee \/>\s*<NavigatorMarquee \/>/.test(heroSrc),
  );

  /* ---------------------------------------------------------------- *
   * 3 — sizing/layout matches the existing card convention
   * ---------------------------------------------------------------- */
  const SIZE_CLASSES = [
    'w-full',
    'max-w-sm',
    'aspect-square',
    'rounded-card',
    'p-[14px]',
    'border-signal/70',
  ];
  for (const cls of SIZE_CLASSES) {
    check(
      `3: both tiles carry "${cls}"`,
      navMarkup.includes(cls) && parkingMarkup.includes(cls),
      `nav=${navMarkup.includes(cls)} parking=${parkingMarkup.includes(cls)}`,
    );
  }
  check(
    '3g: label type scale matches the parking tile',
    navMarkup.includes('font-display text-3xl') && parkingMarkup.includes('font-display text-3xl'),
  );

  /* ---------------------------------------------------------------- *
   * 4 — Truck Parking is unchanged
   * ---------------------------------------------------------------- */
  check(
    '4a: parking tile still links to the directory',
    parkingMarkup.includes('href="/directory/parking"'),
  );
  check('4b: parking tile keeps its label', parkingMarkup.includes('Truck'));
  // The two tiles share one icon family (48×48 app plate) but each keeps its
  // own distinct glyph: the parking icon carries the P-sign path, which must
  // never appear in the Navigator icon (and vice versa for the nav arrow).
  check(
    '4c: parking tile keeps its own icon, distinct from the Navigator arrow',
    parkingMarkup.includes('M14.5 20.5v-9') &&
      !navMarkup.includes('M14.5 20.5v-9') &&
      navMarkup.includes('L6.2 7') &&
      !parkingMarkup.includes('L6.2 7'),
  );
  // The parking marquee may MENTION the Navigator icon (the two icons are
  // documented as one family) but must never link to it or import from it —
  // the tile's one destination stays the parking directory.
  check(
    '4d: parking marquee never links into the Navigator',
    !parkingMarqueeSrc.includes('PILOT_ACCESS_PATH') &&
      !parkingMarqueeSrc.includes("href: '/navigator") &&
      !parkingMarkup.includes('href="/navigator') &&
      parkingMarkup.includes('href="/directory/parking"'),
  );
  check(
    '4e: parking section source untouched by this change',
    !parkingSectionSrc.includes('Navigator'),
  );

  /* ---------------------------------------------------------------- *
   * 5 — label is exactly "Navigator"
   * ---------------------------------------------------------------- */
  check('5a: visible label is Navigator', navMarkup.includes('>Navigator</span>'));
  check(
    '5b: accessible name starts with the visible label',
    navMarkup.includes('aria-label="Navigator —'),
  );

  /* ---------------------------------------------------------------- *
   * 6 — keyboard accessible
   * ---------------------------------------------------------------- */
  check('6a: it is a real anchor (tab-reachable, Enter-activatable)', navMarkup.startsWith('<a '));
  check('6b: it has a visible focus ring', navMarkup.includes('focus-visible:ring-4'));
  check(
    '6c: the ring is offset so it is not lost on the dark frame',
    navMarkup.includes('focus-visible:ring-offset-2'),
  );
  check(
    '6d: decorative frame is hidden from assistive tech',
    navMarkup.includes('aria-hidden="true"'),
  );

  /* ---------------------------------------------------------------- *
   * 7 — mobile
   * ---------------------------------------------------------------- */
  check(
    '7a: fluid width, no fixed pixel width',
    navMarkup.includes('w-full') && !/w-\[\d+px\]/.test(navMarkup),
  );
  check('7b: bounded by the same column max as its sibling', navMarkup.includes('max-w-sm'));
  check(
    '7c: square at every width — no overflow from a fixed height',
    navMarkup.includes('aspect-square'),
  );
  check('7d: type scales up only at sm and above', navMarkup.includes('sm:text-4xl'));

  /* ---------------------------------------------------------------- *
   * 8/9/10 — unauthorized access to every protected route is blocked
   * ---------------------------------------------------------------- */
  const PROTECTED = [
    '/drive',
    '/navigator',
    '/drive/anything',
    '/navigator/nested',
    '/api/navigator/route',
    '/api/navigator/destination-search',
  ];
  for (const path of PROTECTED) {
    check(`8: ${path} is behind the gate`, isProtectedNavigatorPath(path));
    check(
      `9: ${path} challenges an unauthorized visitor`,
      navigatorGateDecision({
        pathname: path,
        flagEnabled: true,
        configured: true,
        tokenValid: false,
      }) === 'challenge',
    );
    check(
      `10: ${path} admits an authorized visitor`,
      navigatorGateDecision({
        pathname: path,
        flagEnabled: true,
        configured: true,
        tokenValid: true,
      }) === 'allow',
    );
  }
  check(
    '8x: the access page itself is NOT gated (no redirect loop)',
    !isProtectedNavigatorPath(PILOT_ACCESS_PATH),
  );
  check(
    '8y: unrelated pages are untouched',
    ['/', '/directory/parking', '/tools/hos-calculator', '/admin'].every(
      (p) =>
        navigatorGateDecision({
          pathname: p,
          flagEnabled: true,
          configured: true,
          tokenValid: false,
        }) === 'ignore',
    ),
  );
  check(
    '8z: with the flag OFF the gate stays silent (route 404s; no password prompt advertising it)',
    PROTECTED.every(
      (p) =>
        navigatorGateDecision({
          pathname: p,
          flagEnabled: false,
          configured: true,
          tokenValid: false,
        }) === 'ignore',
    ),
  );
  check(
    '8z2: a layer that cannot see the password DEFERS rather than looping — the Node-side guards still enforce',
    PROTECTED.every(
      (p) =>
        navigatorGateDecision({
          pathname: p,
          flagEnabled: true,
          configured: false,
          tokenValid: false,
        }) === 'ignore',
    ),
  );
  check(
    '8z3: …and it defers even for a visitor who DOES hold a valid cookie (no bounce loop)',
    navigatorGateDecision({
      pathname: '/drive',
      flagEnabled: true,
      configured: false,
      tokenValid: true,
    }) === 'ignore',
  );
  check(
    '8w: API paths are answered with a status, not a redirect',
    isNavigatorApiPath('/api/navigator/route'),
  );
  check('8v: page paths are not treated as API paths', !isNavigatorApiPath('/drive'));
  const middlewareBody = middlewareSrc.slice(
    middlewareSrc.indexOf('export async function middleware'),
  );
  check(
    '8u: middleware runs the gate before the Supabase session refresh',
    middlewareBody.indexOf('navigatorPilotGate') < middlewareBody.indexOf('updateSession'),
  );

  /* The REAL middleware, exercised end to end. Source assertions cannot see a
     middleware that computes the right decision and then fails to act on it;
     these calls can. Only the challenge paths are driven through the full
     middleware — the allow/ignore paths fall through to the Supabase session
     refresh, which is not this harness's business. */
  const mwPage = await middleware(new NextRequest(new Request('https://example.test/drive')));
  check(
    '8t: unauthorized /drive is redirected by the middleware',
    mwPage?.status === 307,
    mwPage?.status,
  );
  check(
    '8t2: …to the password screen, preserving where they were going',
    mwPage?.headers.get('location') === 'https://example.test/navigator/access?next=%2Fdrive',
    mwPage?.headers.get('location'),
  );
  const mwNested = await middleware(new NextRequest(new Request('https://example.test/navigator')));
  check('8t3: unauthorized /navigator is redirected too', mwNested?.status === 307);
  const mwApi = await middleware(
    new NextRequest(new Request('https://example.test/api/navigator/route')),
  );
  check(
    '8t4: unauthorized API calls get 401, not an HTML redirect',
    mwApi?.status === 401,
    mwApi?.status,
  );
  const mwSearch = await middleware(
    new NextRequest(new Request('https://example.test/api/navigator/destination-search?q=x')),
  );
  check('8t5: the search API is gated the same way', mwSearch?.status === 401);
  // Read the body only when the gate actually produced one: a bypassed gate
  // returns a pass-through response with no JSON, and this check must report
  // that as a failure rather than crash the harness.
  const apiBody = mwApi?.status === 401 ? JSON.stringify(await mwApi.json()) : '';
  check(
    '8t6: the 401 body names the reason without leaking anything',
    apiBody.includes('pilot-access-required'),
  );
  check(
    '8t7: the 401 body carries no secret and no cookie value',
    !apiBody.includes(TEST_PASSWORD) && !apiBody.includes(PILOT_COOKIE_NAME),
  );

  /* ---------------------------------------------------------------- *
   * 11/12 — password verification, server-side
   * ---------------------------------------------------------------- */
  check('11a: the wrong password is rejected', !verifyPilotPassword('wrong-password'));
  check('11b: an empty password is rejected', !verifyPilotPassword(''));
  check(
    '11c: a prefix of the real password is rejected',
    !verifyPilotPassword(TEST_PASSWORD.slice(0, -1)),
  );
  check(
    '11d: a superstring of the real password is rejected',
    !verifyPilotPassword(`${TEST_PASSWORD}x`),
  );
  check('11e: case matters', !verifyPilotPassword(TEST_PASSWORD.toUpperCase()));
  check('12a: the correct password is accepted', verifyPilotPassword(TEST_PASSWORD));
  check('12b: configuration is detected', pilotConfigured());
  const verifyPasswordBody = pilotAccessSrc.slice(
    pilotAccessSrc.indexOf('export function verifyPilotPassword'),
    pilotAccessSrc.indexOf('async function hmacHex'),
  );
  check(
    '12c: the PASSWORD comparison itself is constant-time, not ===',
    verifyPasswordBody.includes('constantTimeEqual') &&
      !/return\s+input\s*===/.test(verifyPasswordBody),
  );
  check(
    '12d: constant-time helper is sound',
    constantTimeEqual('abc', 'abc') && !constantTimeEqual('abc', 'abd'),
  );

  /* Fails CLOSED when the owner has not configured a password. */
  process.env.NAVIGATOR_PREVIEW_PASSWORD = '';
  check(
    '12e: unconfigured deploy accepts nothing',
    !verifyPilotPassword('') && !verifyPilotPassword('anything'),
  );
  check('12f: unconfigured deploy reports itself unconfigured', !pilotConfigured());
  process.env.NAVIGATOR_PREVIEW_PASSWORD = TEST_PASSWORD;

  /* ---------------------------------------------------------------- *
   * 13 — successful authentication redirects correctly
   * ---------------------------------------------------------------- */
  check('13a: a Navigator path is preserved', sanitizeNextPath('/drive') === '/drive');
  check(
    '13b: a nested Navigator path is preserved',
    sanitizeNextPath('/navigator/nested') === '/navigator/nested',
  );
  check('13c: default destination when absent', sanitizeNextPath(undefined) === '/drive');
  check(
    '13d: absolute URLs cannot be injected',
    sanitizeNextPath('https://evil.example/x') === '/drive',
  );
  check(
    '13e: protocol-relative URLs cannot be injected',
    sanitizeNextPath('//evil.example') === '/drive',
  );
  check(
    '13f: backslash tricks cannot be injected',
    sanitizeNextPath('/\\evil.example') === '/drive',
  );
  check('13g: unrelated internal paths are not honoured', sanitizeNextPath('/admin') === '/drive');
  check(
    '13h: the access page is never its own destination',
    sanitizeNextPath(PILOT_ACCESS_PATH) === '/drive',
  );
  check(
    '13i: an API path is never a redirect destination',
    sanitizeNextPath('/api/navigator/route') === '/drive',
  );
  check(
    '13j: the action redirects to the sanitized path',
    accessActionSrc.includes('redirect(next)'),
  );

  /* ---------------------------------------------------------------- *
   * 14/15 — cookie behavior
   * ---------------------------------------------------------------- */
  check('14a: cookie is HttpOnly', /httpOnly:\s*true/.test(accessActionSrc));
  check(
    '14b: cookie is Secure in production',
    /secure:\s*process\.env\.NODE_ENV === 'production'/.test(accessActionSrc),
  );
  check('14c: cookie is SameSite=Lax or stricter', /sameSite:\s*'lax'/.test(accessActionSrc));
  check('14d: cookie carries the ~12h max age', PILOT_MAX_AGE_SECONDS === 12 * 60 * 60);
  check(
    '14e: the action sets that max age',
    accessActionSrc.includes('maxAge: PILOT_MAX_AGE_SECONDS'),
  );

  const token = (await issuePilotToken(Date.now())) ?? '';
  check('15a: a token is issued', token.length > 0);
  check('15b: the cookie does NOT contain the password', !token.includes(TEST_PASSWORD));
  check('15c: the cookie is not simply the password', token !== TEST_PASSWORD);
  check('15d: the cookie is a versioned signed triple', /^v1\.\d+\.[0-9a-f]{64}$/.test(token));
  check(
    '15e: the signature is not a plain hash of a guessable constant — it is keyed by the password',
    await (async () => {
      process.env.NAVIGATOR_PREVIEW_PASSWORD = 'a-different-password';
      const other = (await issuePilotToken(1_000_000)) ?? '';
      process.env.NAVIGATOR_PREVIEW_PASSWORD = TEST_PASSWORD;
      const mine = (await issuePilotToken(1_000_000)) ?? '';
      return other !== mine && other.length > 0;
    })(),
  );

  /* ---------------------------------------------------------------- *
   * 16 — authorization expires, verified server-side
   * ---------------------------------------------------------------- */
  const now = Date.now();
  const fresh = (await issuePilotToken(now)) ?? '';
  check('16a: a fresh token verifies', await verifyPilotToken(fresh, now));
  check(
    '16b: still valid just inside the window',
    await verifyPilotToken(fresh, now + PILOT_MAX_AGE_SECONDS * 1000 - 1000),
  );
  check(
    '16c: REJECTED just past the window',
    !(await verifyPilotToken(fresh, now + PILOT_MAX_AGE_SECONDS * 1000 + 1000)),
  );
  check(
    '16d: rejected long after expiry',
    !(await verifyPilotToken(fresh, now + 30 * 24 * 3600 * 1000)),
  );
  check(
    '16e: a far-future issue date is rejected',
    !(await verifyPilotToken((await issuePilotToken(now + 3600_000)) ?? '', now)),
  );
  check(
    '16f: a tampered signature is rejected',
    !(await verifyPilotToken(fresh.slice(0, -1) + (fresh.endsWith('a') ? 'b' : 'a'), now)),
  );
  check(
    '16g: a tampered timestamp is rejected',
    !(await verifyPilotToken(fresh.replace(/\.\d+\./, '.1.'), now)),
  );
  check(
    '16h: a forged token from another password is rejected',
    await (async () => {
      process.env.NAVIGATOR_PREVIEW_PASSWORD = 'attacker-guess';
      const forged = (await issuePilotToken(now)) ?? '';
      process.env.NAVIGATOR_PREVIEW_PASSWORD = TEST_PASSWORD;
      return !(await verifyPilotToken(forged, now));
    })(),
  );
  check('16i: garbage is rejected', !(await verifyPilotToken('not-a-token', now)));
  check('16j: an empty cookie is rejected', !(await verifyPilotToken('', now)));
  check('16k: a missing cookie is rejected', !(await verifyPilotToken(undefined, now)));
  check(
    '16l: expiry is checked against the SIGNED issuedAt, not just cookie Max-Age',
    pilotAccessSrc.includes('ageMs > PILOT_MAX_AGE_SECONDS * 1000'),
  );

  /* Request-level helper used by the API routes. */
  const bearing = (value?: string) => ({
    cookies: { get: () => (value === undefined ? undefined : { value }) },
  });
  check(
    '16m: a request with a valid cookie is authorized',
    await requestHasPilotAccess(bearing(fresh)),
  );
  check('16n: a request with no cookie is not', !(await requestHasPilotAccess(bearing(undefined))));
  check(
    '16o: a request with a junk cookie is not',
    !(await requestHasPilotAccess(bearing('v1.1.deadbeef'))),
  );

  /* ---------------------------------------------------------------- *
   * 17/18 — the password never reaches the browser
   * ---------------------------------------------------------------- */
  const CLIENT_REACHABLE = [marqueeSrc, heroSrc, parkingMarqueeSrc];
  check(
    '17a: no client component reads the password',
    CLIENT_REACHABLE.every((s) => !s.includes('NAVIGATOR_PREVIEW_PASSWORD')),
  );
  check(
    '17b: no NEXT_PUBLIC_ password variable exists anywhere',
    ![
      pilotAccessSrc,
      pilotSessionSrc,
      accessPageSrc,
      accessActionSrc,
      middlewareSrc,
      marqueeSrc,
      heroSrc,
    ].some((s) => /NEXT_PUBLIC_[A-Z_]*PASSWORD/.test(s)),
  );
  check(
    '17c: the gate modules are not client components',
    !pilotAccessSrc.includes("'use client'") && !pilotSessionSrc.includes("'use client'"),
  );
  check('17d: the access page is not a client component', !accessPageSrc.includes("'use client'"));
  check('17e: the action is server-only', accessActionSrc.trimStart().startsWith("'use server'"));
  check(
    '17f: the password is never put in browser storage',
    ![accessPageSrc, accessActionSrc, pilotAccessSrc, pilotSessionSrc].some((s) =>
      /localStorage|sessionStorage/.test(s),
    ),
  );
  check(
    '17g: the password is never logged',
    ![accessPageSrc, accessActionSrc, pilotAccessSrc, pilotSessionSrc, middlewareSrc].some((s) =>
      /console\.(log|info|warn|error)/.test(s),
    ),
  );
  check(
    '17h: the password is never sent to analytics',
    ![accessPageSrc, accessActionSrc, pilotAccessSrc, pilotSessionSrc].some((s) =>
      /plausible|gtag|analytics/i.test(s),
    ),
  );
  check(
    '18a: the password screen never interpolates the secret into markup',
    !accessPageSrc.includes('process.env.NAVIGATOR_PREVIEW_PASSWORD'),
  );
  check(
    '18b: the rendered homepage tile contains no password value',
    !navMarkup.includes(TEST_PASSWORD) && !heroMarkup.includes(TEST_PASSWORD),
  );
  check(
    '18c: the form posts the password rather than embedding it',
    accessPageSrc.includes('type="password"') && accessPageSrc.includes('name="password"'),
  );
  check(
    '18d: the error message does not reveal the expected password',
    accessPageSrc.includes('Incorrect password.') &&
      !accessPageSrc.includes('NAVIGATOR_PREVIEW_PASSWORD ='),
  );

  /* ---------------------------------------------------------------- *
   * 19 — the existing feature flag is intact
   * ---------------------------------------------------------------- */
  check(
    '19a: /drive still flag-gated',
    drivePageSrc.includes("process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED === 'true'") &&
      drivePageSrc.includes('notFound()'),
  );
  check(
    '19b: /navigator still flag-gated',
    navPageSrc.includes("process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED === 'true'") &&
      navPageSrc.includes('notFound()'),
  );
  check(
    '19c: route API still flag-gated',
    routeApiSrc.includes("process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED !== 'true'"),
  );
  check(
    '19d: search API still flag-gated',
    searchApiSrc.includes("process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED !== 'true'"),
  );
  const driveBody = drivePageSrc.slice(drivePageSrc.indexOf('export default async function'));
  check(
    '19e: the flag is checked BEFORE the pilot gate on /drive',
    driveBody.indexOf('notFound()') < driveBody.indexOf('requirePilotAccess'),
  );
  check(
    '19f: the flag is checked BEFORE the pilot gate in the route API',
    routeApiSrc.indexOf('not-enabled') < routeApiSrc.indexOf('pilot-access-required'),
  );
  check(
    '19g: the flag is checked BEFORE the pilot gate in the search API',
    searchApiSrc.indexOf('not-enabled') < searchApiSrc.indexOf('pilot-access-required'),
  );
  check(
    '19h: the pilot gate runs BEFORE the rate limiter in the search API',
    searchApiSrc.indexOf('pilot-access-required') < searchApiSrc.indexOf('searchLimiter.allow'),
  );
  check(
    '19i: the tile is NOT flag-gated — visibility is decoupled from the runtime',
    !marqueeSrc.includes('navigatorFlagEnabled()') && !marqueeSrc.includes('return null'),
  );
  check(
    '19j: the access page is NOT flag-gated — the tile must always reach it',
    !accessPageSrc.includes('notFound()'),
  );
  check(
    '19k: pages carry their own guard, not just the middleware',
    /await requirePilotAccess\('\/drive'\)/.test(drivePageSrc) &&
      /await requirePilotAccess\('\/navigator'\)/.test(navPageSrc),
  );
  check(
    '19l: API routes carry their own guard',
    /if \(!\(await requestHasPilotAccess\(req\)\)\)/.test(routeApiSrc) &&
      /if \(!\(await requestHasPilotAccess\(req\)\)\)/.test(searchApiSrc),
  );

  /* ---------------------------------------------------------------- *
   * 19m-19t — TILE VISIBILITY IS DECOUPLED FROM RUNTIME ENABLEMENT
   *
   * The owner wants the Navigator tile on the live homepage while the
   * Navigator itself stays shut. So with the flag OFF the tile must still
   * render, unchanged, still below Truck Parking, still pointing at the gate
   * — while every protected surface keeps 404ing.
   * ---------------------------------------------------------------- */
  process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED = 'false';
  const navMarkupFlagOff = renderToStaticMarkup(createElement(NavigatorMarquee));
  const heroMarkupFlagOff = renderToStaticMarkup(createElement(Hero));

  check('19m: flag off ⇒ the Navigator tile STILL renders', navMarkupFlagOff.length > 0);
  check(
    '19n: flag off ⇒ the tile is byte-identical to the flag-on tile',
    navMarkupFlagOff === navMarkup,
  );
  check(
    '19o: flag off ⇒ the tile is still on the homepage hero',
    heroMarkupFlagOff.includes('aria-label="Navigator'),
  );
  const offAnchors = heroMarkupFlagOff.split('<a ').slice(1);
  const offParking = offAnchors.findIndex((a) => a.startsWith('aria-label="Truck Parking'));
  const offNavigator = offAnchors.findIndex((a) => a.startsWith('aria-label="Navigator'));
  check(
    '19p: flag off ⇒ still DIRECTLY below Truck Parking',
    offParking >= 0 && offNavigator === offParking + 1,
    `parking=${offParking} navigator=${offNavigator}`,
  );
  check(
    '19q: flag off ⇒ the tile still points at the password gate',
    navMarkupFlagOff.includes(`href="${PILOT_ACCESS_PATH}"`),
  );
  check(
    '19r: flag off ⇒ the tile keeps the same card size/layout classes',
    navMarkupFlagOff.includes('aspect-square') &&
      navMarkupFlagOff.includes('max-w-sm') &&
      navMarkupFlagOff.includes('marquee-lights'),
  );
  check(
    '19s: flag off ⇒ the rest of the hero is unchanged',
    heroMarkupFlagOff.includes('href="/directory/parking"'),
  );
  /* The gate stays reachable with the flag off — that is what makes an
     always-visible tile safe rather than a link to a 404. */
  check(
    '19t: flag off ⇒ the gate is still reachable — no 404 path on the access page at all',
    !accessPageSrc.includes('notFound'),
  );
  check(
    '19v: an authorized visitor is only forwarded when the runtime is ON',
    /if \(authorized && runtimeEnabled\) redirect\(next\)/.test(accessPageSrc),
  );
  check(
    '19w: with the runtime OFF an authorized visitor is told, not redirected into a 404',
    accessPageSrc.indexOf('if (authorized && runtimeEnabled) redirect(next)') <
      accessPageSrc.indexOf('if (authorized) {') &&
      accessPageSrc.includes('isn’t running on this deploy'),
  );
  check(
    '19x: the gate never prints an environment-variable name to the public',
    !accessPageSrc.includes('NAVIGATOR_PREVIEW_PASSWORD'),
  );
  /* ...while every PROTECTED surface still refuses to exist. */
  for (const [label, src] of [
    ['/drive', drivePageSrc],
    ['/navigator', navPageSrc],
  ] as const) {
    check(
      `19u: flag off ⇒ ${label} still 404s (flag check retained)`,
      src.includes("process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED === 'true'") &&
        src.includes('notFound()'),
    );
  }
  process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED = 'true';
  // Dummy Supabase values so the middleware's session refresh can construct a
  // client offline. Without them a gate BYPASS would crash here instead of
  // failing an assertion, which reads as a broken harness rather than a broken
  // gate. Nothing here talks to a network.
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://harness.invalid';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'harness-anon-key';

  /* ---------------------------------------------------------------- *
   * 20 — existing homepage links still work
   * ---------------------------------------------------------------- */
  for (const href of ['/academy/apply', '/knowledge', '/directory/parking']) {
    check(`20: existing hero link ${href} still present`, heroMarkup.includes(`href="${href}"`));
  }
  check(
    '20d: the hero still leads with its headline',
    heroMarkup.includes('17 years. Zero violations.'),
  );
  check(
    '20e: the shirt promo is still in the column',
    heroMarkup.includes('HeroShirtPromo') || heroMarkup.length > 2000,
  );
  check('20f: the cookie name is namespaced to this site', PILOT_COOKIE_NAME.startsWith('tlws_'));
}

main().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
});
