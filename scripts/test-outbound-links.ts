/**
 * Outbound-link compliance tests (offline, source-level).
 *
 * The defect: `/books` rendered its primary money CTA as
 * `<Button href={book.href}>Buy on Amazon</Button>`. `Button` only emits an
 * anchor with `target="_blank"` and a `rel` when it is given `external` —
 * without it the affiliate URL went out through a Next `<Link>`, so the
 * highest-intent link on the page carried **no `rel="sponsored"`** (required by
 * Amazon Associates and by Google for paid links, and applied everywhere else
 * in the codebase via `AMAZON_REL`) and navigated the reader off the site. The
 * "read reviews on Amazon" link three sections up had it right, which is how
 * the inconsistency stayed invisible. Two Stan Store CTAs had the same shape.
 *
 * Run:
 *   npx esbuild scripts/test-outbound-links.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-outbound-links.cjs && node /tmp/test-outbound-links.cjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { AMAZON_REL, AMAZON_ASSOCIATE_TAG, amazonProductUrl } from '@/lib/store/amazon';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const ROOT = process.cwd();
const files = walk(join(ROOT, 'src'));

/* ---------------- <Button> pointing off-site must be `external` --------- */
{
  const offenders: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/<Button\b[^>]*?>/gs)) {
      const tag = m[0];
      const href = /href=(?:"([^"]*)"|\{([^}]*)\})/.exec(tag);
      if (!href) continue;
      const value = (href[1] ?? href[2] ?? '').trim();
      // Off-site means either a literal http(s) URL, or one of the identifiers
      // this codebase uses to hold one. Keeping the identifier list explicit
      // beats guessing: a new off-site constant is a deliberate addition, and
      // adding it here is the reminder to pass `external`.
      const OFF_SITE_IDENTIFIERS = [
        'STAN_STORE',
        'book.href',
        'PRESCHOOL_PURCHASE_URL',
        'SHIRT_URL',
      ];
      const offSite = /^https?:\/\//.test(value) || OFF_SITE_IDENTIFIERS.some((id) => value === id);
      if (!offSite) continue;
      if (!/\bexternal\b/.test(tag)) {
        offenders.push(
          `${relative(ROOT, file)}:${src.slice(0, m.index).split('\n').length} → <Button href={${value}}> without \`external\``,
        );
      }
    }
  }
  check(
    'buttons: every off-site <Button> is marked external (new tab + rel)',
    offenders.length === 0,
    offenders,
  );
}

/* -------------------- affiliate links disclose themselves -------------- */
{
  // Any anchor or Button whose href carries the associate tag, or points at the
  // Stan Store, is a paid link and must say so.
  const offenders: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/<(a|Button)\b[^>]*?>/gs)) {
      const tag = m[0];
      const paid =
        tag.includes(AMAZON_ASSOCIATE_TAG) ||
        tag.includes('stan.store') ||
        /href=\{(STAN_STORE|book\.href)\}/.test(tag);
      if (!paid) continue;
      if (!/rel=\{?["']?[^"'}]*sponsored/.test(tag) && !/rel=\{[A-Z_]*REL\}/.test(tag)) {
        offenders.push(
          `${relative(ROOT, file)}:${src.slice(0, m.index).split('\n').length} → paid link without rel="sponsored"`,
        );
      }
    }
  }
  check('affiliate: every paid link carries rel="sponsored"', offenders.length === 0, offenders);
}

/* ------------------------- the /books page, specifically --------------- */
{
  const books = readFileSync(join(ROOT, 'src/app/(marketing)/books/page.tsx'), 'utf8');
  check(
    'books: the Buy on Amazon CTA is external + sponsored',
    /<Button href=\{book\.href\} external rel="sponsored">/.test(books),
    books.match(/<Button href=\{book\.href\}[^>]*>/)?.[0],
  );
  check(
    'books: no bare <Button> points at an amazon.com URL',
    !/<Button[^>]*href="https:\/\/(www\.)?a(mazon)?\.co/.test(books.replace(/external/g, 'EXT')),
  );
  const apps = readFileSync(join(ROOT, 'src/app/(marketing)/apps/page.tsx'), 'utf8');
  check(
    'apps: the Stan Store CTA is external + sponsored',
    /<Button href=\{STAN_STORE\} external rel="sponsored">/.test(apps),
    apps.match(/<Button href=\{STAN_STORE\}[^>]*>/)?.[0],
  );
}

/* ---------------------------- the shared rel contract ------------------ */
{
  check('amazon: AMAZON_REL discloses the paid relationship', AMAZON_REL.includes('sponsored'));
  check('amazon: AMAZON_REL is safe for a new tab', AMAZON_REL.includes('noopener'));
  check(
    'amazon: a product URL carries the associate tag exactly once',
    (amazonProductUrl('B0FDL26V8Q')?.match(new RegExp(AMAZON_ASSOCIATE_TAG, 'g')) ?? []).length ===
      1,
    amazonProductUrl('B0FDL26V8Q'),
  );
  check('amazon: an invalid ASIN yields no link', amazonProductUrl('nope') === null);
}

console.log(`\noutbound-links: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
