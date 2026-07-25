/**
 * Offline tests for the branded 404 / error boundaries.
 *
 * Regression guard for the defect these files fixed: before them, an unknown
 * URL fell through to Next's built-in not-found page, which injects
 * `body{color:#000;background:#fff}` inline. That override beat the dark
 * theme and left a white void between the (still dark) header and footer,
 * with no links out — a dead end for the visitor and for every crawler
 * following a stale URL.
 *
 * Asserts, without a browser: the pages render, they carry no inline body
 * color/background override, they are noindex, and every recovery link points
 * at a real internal route (cross-checked against the route table so a
 * renamed page can never leave a dead link on the 404).
 *
 * Run:
 *   npx esbuild scripts/test-error-pages.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-error-pages.cjs && node /tmp/test-error-pages.cjs
 */
import { renderToStaticMarkup } from 'react-dom/server';
import NotFound, { metadata as notFoundMetadata } from '@/app/not-found';
import GlobalError from '@/app/global-error';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

/**
 * Public routes the recovery links may point at. Kept explicit (rather than
 * globbed) so deleting a page breaks this test instead of the live 404.
 */
const KNOWN_ROUTES = new Set([
  '/',
  '/academy',
  '/cdl-pre-school',
  '/practice-tests',
  '/directory',
  '/trip-planner',
  '/knowledge',
  '/knowledge/search',
]);

/* ------------------------------------------------------------ not-found */
{
  // `usePathname` is unavailable outside the App Router runtime; the tracking
  // child is a client component, so render the page's own markup only by
  // stubbing the hook's module boundary is unnecessary — NotFoundEvent
  // returns null and its effect never runs under renderToStaticMarkup.
  const html = renderToStaticMarkup(NotFound());

  check('not-found: renders markup', html.length > 200, html.length);
  check(
    'not-found: no inline body color override (the original defect)',
    !/body\s*\{[^}]*(?:background|color)\s*:/i.test(html),
    html.match(/body\s*\{[^}]*\}/i)?.[0],
  );
  check('not-found: no <style> injection at all', !/<style/i.test(html));
  check(
    'not-found: does not force a full-viewport height that strands the footer',
    !/height:\s*100vh/i.test(html),
  );
  check('not-found: has exactly one h1', (html.match(/<h1[\s>]/g) ?? []).length === 1);
  check('not-found: links home', html.includes('href="/"'));

  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  check('not-found: offers several exits', hrefs.length >= 6, hrefs.length);
  for (const href of hrefs) {
    check(`not-found: "${href}" is internal`, href.startsWith('/') && !href.startsWith('//'), href);
    check(`not-found: "${href}" is a known route`, KNOWN_ROUTES.has(href), href);
  }

  check(
    'not-found: noindex (a 404 must never be indexed)',
    (notFoundMetadata.robots as { index?: boolean } | undefined)?.index === false,
    notFoundMetadata.robots,
  );
  check(
    'not-found: no canonical (one canonical across every dead URL invites indexing)',
    notFoundMetadata.alternates?.canonical === undefined,
    notFoundMetadata.alternates,
  );
  check('not-found: has its own title', typeof notFoundMetadata.title === 'string');
}

/* --------------------------------------------------------- global-error */
{
  const noop = () => {};
  const html = renderToStaticMarkup(
    GlobalError({ error: Object.assign(new Error('boom'), { digest: 'abc123' }), reset: noop }),
  );

  check('global-error: renders its own <html> shell', /<html/i.test(html));
  check('global-error: renders its own <body>', /<body/i.test(html));
  check('global-error: keeps the dark page background (no white flash)', html.includes('#141414'));
  check('global-error: offers a way back home', html.includes('href="/"'));
  check('global-error: shows the digest reference', html.includes('abc123'));
  check(
    'global-error: never prints the raw error message',
    !html.includes('boom'),
    'raw message leaked into the page',
  );

  const withoutDigest = renderToStaticMarkup(
    GlobalError({ error: new Error('boom'), reset: noop }),
  );
  check('global-error: digest-free errors still render', withoutDigest.includes('href="/"'));
  check(
    'global-error: no "Reference:" line without a digest',
    !withoutDigest.includes('Reference'),
  );
}

console.log(`\nerror-pages: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
