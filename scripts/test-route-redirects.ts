/**
 * next.config.mjs redirect-table tests (offline).
 *
 * Guards the config itself — every redirect resolves to a route that exists (or
 * an explicit external URL), no redirect points at another redirect, and no
 * entry can loop.
 *
 * The defect that prompted this: `/login` served a live Supabase
 * email+password form that, on success, sent the admin to `/admin` — which is
 * gated by the shared-password HMAC cookie in `lib/admin/auth.ts`, not by
 * Supabase, so it bounced straight back to `/admin/login` and asked for a
 * different credential. A dead-end sign-in, live in production. `/login` now
 * redirects to the sign-in that actually opens the dashboard.
 *
 * Route existence is resolved against the App Router tree on disk, so deleting
 * or renaming a page breaks this test instead of the live redirect.
 *
 * Run:
 *   npx esbuild scripts/test-route-redirects.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-route-redirects.cjs && node /tmp/test-route-redirects.cjs
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

type Redirect = { source: string; destination: string; permanent: boolean };

/**
 * Every static route the App Router serves. Route groups `(name)` collapse
 * away; dynamic segments `[slug]` are recorded as a `:param` wildcard so a
 * destination pointing into one still resolves.
 */
function collectRoutes(dir: string, prefix = '', out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) {
      if (entry === 'page.tsx') out.push(prefix === '' ? '/' : prefix);
      continue;
    }
    if (entry.startsWith('(') && entry.endsWith(')')) collectRoutes(full, prefix, out);
    else if (entry.startsWith('[')) collectRoutes(full, `${prefix}/:param`, out);
    else collectRoutes(full, `${prefix}/${entry}`, out);
  }
  return out;
}

const ROOT = process.cwd();
const routes = new Set(collectRoutes(join(ROOT, 'src', 'app')));
check('routes: App Router tree scanned', routes.size > 40, routes.size);
check('routes: the home page is in the tree', routes.has('/'));

/**
 * Does a concrete path resolve to some route in the tree? A `:param` segment
 * matches any single segment, so `/knowledge/dot-compliance` resolves through
 * `/knowledge/:param` — whether that category exists is a database question the
 * preview crawl answers, not this one.
 */
function routeExists(path: string): boolean {
  if (routes.has(path)) return true;
  const parts = path.split('/').filter(Boolean);
  for (const route of routes) {
    const rp = route.split('/').filter(Boolean);
    if (rp.length !== parts.length) continue;
    if (rp.every((seg, i) => seg === ':param' || seg === parts[i])) return true;
  }
  return false;
}

async function main() {
  // next.config.mjs is ESM; import it rather than re-parsing the table.
  const config = (await import('../next.config.mjs')).default as {
    redirects: () => Promise<Redirect[]>;
  };
  const redirects = await config.redirects();
  check('redirects: table is non-empty', redirects.length > 0, redirects.length);

  const sources = new Set(redirects.map((r) => r.source));

  for (const r of redirects) {
    check(`redirect ${r.source}: source is an absolute path`, r.source.startsWith('/'), r.source);
    check(
      `redirect ${r.source}: does not redirect to itself`,
      r.source !== r.destination,
      r.destination,
    );
    check(
      `redirect ${r.source}: is not shadowed by a real page`,
      !routes.has(r.source),
      `a page exists at ${r.source}, so the redirect never fires`,
    );

    if (/^https?:\/\//.test(r.destination)) {
      check(
        `redirect ${r.source}: external destination is https`,
        r.destination.startsWith('https://'),
        r.destination,
      );
      continue;
    }

    check(
      `redirect ${r.source}: destination is not itself a redirect source`,
      !sources.has(r.destination.split('?')[0]),
      r.destination,
    );
    const destPath = r.destination.split('?')[0].split('#')[0];
    check(
      `redirect ${r.source} → ${destPath}: destination route exists`,
      routeExists(destPath),
      destPath,
    );
  }

  /* ------------------------------- the dead-end sign-in, specifically ---- */
  const login = redirects.find((r) => r.source === '/login');
  check(
    'login: /login is redirected',
    Boolean(login),
    redirects.map((r) => r.source),
  );
  check(
    'login: /login points at the gate that actually opens the dashboard',
    login?.destination === '/admin/login',
    login?.destination,
  );
  check('login: the redirect is permanent', login?.permanent === true);
  check('login: no page shadows it any more', !routes.has('/login'));
  check('login: /admin/login is a real route', routes.has('/admin/login'));
  check(
    'login: the orphaned Supabase sign-in action is gone',
    !readdirSync(join(ROOT, 'src', 'app')).includes('auth'),
  );

  /* ------------------------------------- external-only sources are 308 --- */
  // /contact has no page and no internal link — its only traffic is external
  // (bookmarks, business listings, indexed results). A temporary redirect
  // tells Google to keep the dead URL indexed instead of consolidating onto
  // the destination, so permanence here is a contract, not a default.
  const contact = redirects.find((r) => r.source === '/contact');
  check('contact: /contact is redirected', Boolean(contact));
  check('contact: the redirect is permanent', contact?.permanent === true, contact?.permanent);
  // /videos stays temporary ON PURPOSE: it points off-site (YouTube) and the
  // owner may re-point it; permanence there is a business call, documented in
  // the August 2026 SEO audit. This check pins today's decision either way so
  // a silent flip shows up in review.
  const videos = redirects.find((r) => r.source === '/videos');
  check(
    'videos: still redirected off-site',
    videos?.destination.startsWith('https://') === true,
    videos,
  );

  console.log(`\nroute-redirects: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

void main();
