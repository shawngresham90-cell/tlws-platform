/**
 * Validator for docs/store/first-12-product-input.csv — the owner-fill sheet
 * for activating the first 12 store products.
 *
 * SAFETY-FIRST. This never activates anything and never touches production. It
 * only checks that owner-supplied values are well-formed and safe, so a bad
 * ASIN, a fabricated Amazon URL, a spreadsheet formula-injection cell, or an
 * out-of-bounds image path is caught before any activation step. The affiliate
 * URL is ALWAYS generated from the ASIN by the central helper — never entered
 * by hand — so a `tag=` or amazon URL typed into the sheet is rejected.
 *
 * Run:
 *   npx esbuild scripts/validate-first-12.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/validate-first-12.cjs \
 *     && node /tmp/validate-first-12.cjs
 */
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { isValidAsin, amazonProductUrl, AMAZON_ASSOCIATE_TAG } from '@/lib/store/amazon';

const CSV_PATH = process.argv[2] || 'docs/store/first-12-product-input.csv';
const IMG_ROOT = 'public/images/store/products/';

const EXPECTED_IDS = [
  '12v-cooler-fridge',
  'dual-dash-cam',
  'full-size-cb-radio',
  'memory-foam-seat-cushion',
  '12v-portable-cooker',
  'rand-mcnally-road-atlas',
  'pen-inspection-light',
  'bungee-ratchet-strap-set',
  'windshield-sunshade',
  'blood-pressure-monitor',
  'compact-pure-sine-inverter',
  'over-ear-trucker-headset',
];

const COLUMNS = [
  'product_id', 'product_name', 'asin', 'verified_amazon_title', 'price_usd',
  'price_checked_at', 'rating', 'review_count', 'main_image_path',
  'alt_image_1_path', 'alt_image_2_path', 'shawns_pick', 'driver_tested', 'notes',
];

// ── minimal RFC-4180-ish CSV parser (handles quoted fields) ────────────────
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
}

const errors: string[] = [];
const warnings: string[] = [];
const err = (id: string, msg: string) => errors.push(`[${id}] ${msg}`);
const warn = (id: string, msg: string) => warnings.push(`[${id}] ${msg}`);

const raw = readFileSync(CSV_PATH, 'utf8');
const grid = parseCsv(raw);
const header = grid[0] ?? [];
const dataRows = grid.slice(1);

// Header check
if (header.join(',') !== COLUMNS.join(',')) {
  err('header', `expected columns: ${COLUMNS.join(', ')}`);
}

// Row count
if (dataRows.length !== 12) err('count', `expected exactly 12 product rows, found ${dataRows.length}`);

const seenIds = new Set<string>();
const seenAsins = new Map<string, string>();
const FORMULA = /^[=+\-@\t\r]/;
const AMAZON_URLISH = /amazon\.|amzn\.|\/dp\/|tag=/i;

for (const cols of dataRows) {
  const row: Record<string, string> = {};
  COLUMNS.forEach((c, i) => (row[c] = (cols[i] ?? '').trim()));
  const id = row.product_id || '(blank id)';

  // wrong column count
  if (cols.length !== COLUMNS.length) err(id, `has ${cols.length} columns, expected ${COLUMNS.length}`);

  // known id + no dup
  if (!EXPECTED_IDS.includes(row.product_id)) err(id, 'product_id is not one of the expected 12');
  if (seenIds.has(row.product_id)) err(id, 'duplicate product_id'); else seenIds.add(row.product_id);
  if (!row.product_name) err(id, 'product_name is blank');

  // formula-injection + amazon-url + manual-tag scan on every cell
  for (const c of COLUMNS) {
    const v = row[c];
    if (v && FORMULA.test(v)) err(id, `cell "${c}" looks like a formula-injection value: ${JSON.stringify(v)}`);
    if (v && c !== 'notes' && AMAZON_URLISH.test(v)) err(id, `cell "${c}" contains an Amazon URL / tag — links are generated from the ASIN, never entered: ${JSON.stringify(v)}`);
    if (v && /truckinglif0d-20/.test(v)) err(id, `cell "${c}" contains the affiliate tag manually — never enter it; it is applied centrally`);
  }

  // ASIN
  if (row.asin) {
    if (!isValidAsin(row.asin)) err(id, `invalid ASIN format: ${JSON.stringify(row.asin)}`);
    else {
      const key = row.asin.trim().toUpperCase();
      if (seenAsins.has(key)) err(id, `duplicate ASIN ${key} (also on ${seenAsins.get(key)})`);
      else seenAsins.set(key, id);
    }
  }

  // price optional + positive
  if (row.price_usd) {
    const p = Number(row.price_usd);
    if (!Number.isFinite(p) || p <= 0) err(id, `price_usd must be a positive number: ${JSON.stringify(row.price_usd)}`);
  }
  // rating optional 0..5
  if (row.rating) {
    const r = Number(row.rating);
    if (!Number.isFinite(r) || r < 0 || r > 5) err(id, `rating must be between 0 and 5: ${JSON.stringify(row.rating)}`);
  }
  // review_count optional, non-negative integer
  if (row.review_count) {
    const rc = Number(row.review_count);
    if (!Number.isInteger(rc) || rc < 0) err(id, `review_count must be a non-negative integer: ${JSON.stringify(row.review_count)}`);
  }

  // image paths must live inside the approved dir for THIS product
  for (const c of ['main_image_path', 'alt_image_1_path', 'alt_image_2_path']) {
    const v = row[c];
    if (!v) continue;
    const wantPrefix = `${IMG_ROOT}${row.product_id}/`;
    if (v.includes('..') || !v.startsWith(wantPrefix)) {
      err(id, `${c} must stay inside ${wantPrefix} — got ${JSON.stringify(v)}`);
    } else if (!existsSync(v)) {
      warn(id, `${c} points at ${v} which does not exist yet (add the licensed image)`);
    }
  }

  // yes/no fields
  for (const c of ['shawns_pick', 'driver_tested']) {
    const v = row[c].toLowerCase();
    if (v && v !== 'yes' && v !== 'no') err(id, `${c} must be "yes" or "no" (or blank): ${JSON.stringify(row[c])}`);
  }

  // price_checked_at should look like a date when a price is present
  if (row.price_usd && !row.price_checked_at) warn(id, 'price_usd set but price_checked_at is blank — record when you checked it');
  if (row.price_checked_at && !/^\d{4}-\d{2}-\d{2}/.test(row.price_checked_at)) warn(id, `price_checked_at should be an ISO date (YYYY-MM-DD): ${JSON.stringify(row.price_checked_at)}`);

  // Preview: what the generated affiliate URL WOULD be (never stored here)
  if (isValidAsin(row.asin)) {
    const url = amazonProductUrl(row.asin);
    console.log(`  ${row.product_id}: ready ASIN ${row.asin} → ${url}`);
  }
}

// Missing expected ids
for (const id of EXPECTED_IDS) if (!seenIds.has(id)) err(id, 'expected product missing from the CSV');

// ── Activation readiness summary (informational; nothing is activated here) ─
console.log(`\nAffiliate tag (central, never in CSV): ${AMAZON_ASSOCIATE_TAG}`);
const ready = [...seenAsins.keys()].length;
console.log(`Products with a valid ASIN (activation candidates): ${ready} / 12`);

if (warnings.length) {
  console.log(`\nWARNINGS (${warnings.length}):`);
  warnings.forEach((w) => console.log('  - ' + w));
}
if (errors.length) {
  console.log(`\nERRORS (${errors.length}):`);
  errors.forEach((e) => console.log('  - ' + e));
  console.log('\nVALIDATION FAILED');
  process.exit(1);
}
console.log('\nVALIDATION PASSED — CSV is well-formed and safe (no products activated).');
