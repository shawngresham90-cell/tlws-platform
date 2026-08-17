/**
 * Admin metadata contract (offline).
 *
 * The 2026-08-17 crawl/indexing audit found four admin pages exporting no
 * metadata at all. Next.js merges metadata per-field from the parent segment,
 * so those pages inherited the ROOT layout's defaults — robots
 * `index, follow` and canonical `https://truckinglifewithshawn.com/` — on
 * auth-gated admin URLs. robots.txt disallows /admin, but a disallowed URL
 * that is externally linked can still be indexed URL-only, and none of that
 * protection should hinge on robots.txt alone.
 *
 * Two contracts:
 *  1. Coverage: EVERY page under src/app/admin declares its own metadata (a
 *     `metadata` export or `generateMetadata`), so a future admin page cannot
 *     silently reopen the inheritance gap.
 *  2. Behavior: the four audited pages export robots noindex+nofollow and an
 *     explicit null canonical (child `alternates` replaces the parent's
 *     wholesale, which is what severs the homepage-canonical inheritance).
 *
 * Run:
 *   npx esbuild scripts/test-admin-noindex.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --alias:next/headers=./scripts/shims/next-headers.ts \
 *     --alias:next/cache=./scripts/shims/next-cache.ts \
 *     --loader:.css=empty \
 *     --outfile=/tmp/test-admin-noindex.cjs && node /tmp/test-admin-noindex.cjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Metadata } from 'next';
import { metadata as popularMetadata } from '@/app/admin/(dashboard)/directory/popular/page';
import { metadata as sponsorsMetadata } from '@/app/admin/(dashboard)/directory/sponsors/page';
import { metadata as parkingReportsMetadata } from '@/app/admin/(dashboard)/directory/parking-reports/page';
import { metadata as navigatorUsageMetadata } from '@/app/admin/(dashboard)/navigator/usage/page';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

/* -------------------------------------------- 1. coverage: every admin page */

function pageFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...pageFilesUnder(full));
    else if (entry.name === 'page.tsx') out.push(full);
  }
  return out;
}

const adminPages = pageFilesUnder('src/app/admin');
check('admin page scan finds pages', adminPages.length > 0, adminPages.length);

const withoutMetadata = adminPages.filter((f) => {
  const src = readFileSync(f, 'utf8');
  return !/export\s+(const\s+metadata|(async\s+)?function\s+generateMetadata)/.test(src);
});
check(
  'every admin page declares its own metadata (no root-layout inheritance)',
  withoutMetadata.length === 0,
  withoutMetadata,
);

/* --------------------------------- 2. behavior: the four audited pages */

const AUDITED: Array<[string, Metadata]> = [
  ['admin/directory/popular', popularMetadata],
  ['admin/directory/sponsors', sponsorsMetadata],
  ['admin/directory/parking-reports', parkingReportsMetadata],
  ['admin/navigator/usage', navigatorUsageMetadata],
];

for (const [name, meta] of AUDITED) {
  const robots = meta.robots as { index?: boolean; follow?: boolean } | undefined;
  check(`${name} is noindex`, robots?.index === false, robots);
  check(`${name} is nofollow`, robots?.follow === false, robots);
  const alternates = meta.alternates as { canonical?: unknown } | undefined;
  check(
    `${name} explicitly nulls its canonical (no homepage inheritance)`,
    alternates !== undefined && 'canonical' in alternates && alternates.canonical === null,
    alternates,
  );
  check(`${name} has an admin title`, typeof meta.title === 'string' && meta.title.length > 0);
}

console.log(`\nadmin-noindex: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
