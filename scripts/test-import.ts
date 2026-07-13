/**
 * Unit tests for the directory import pipeline — the single gate every batch and
 * admin CSV upload passes through. Covers header mapping, category resolution
 * (slug + title), boolean/amenity parsing, row validation, and duplicate
 * detection (in-file and vs. existing DB keys). Drives the REAL prepareImport.
 *
 * Run:
 *   npx esbuild scripts/test-import.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-import.cjs && node /tmp/test-import.cjs
 */
import { prepareImport, importDupKey } from '@/lib/directory/import';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

const HEADER =
  'Business Name,Category,Address,City,State,ZIP,Latitude,Longitude,Phone,Website,Description,' +
  'Truck Spaces,Free Parking,Paid Parking,Reserved Parking,Overnight Parking,Showers,Food,Fuel,' +
  'Laundry,Restrooms,Repair,CAT Scale,WiFi,Security,TruckParkingClub URL,Affiliate Code,Image URL,' +
  'Interstate,Exit Number,Published,Featured';

// A complete, valid row builder (positional to the header above).
function row(over: Partial<Record<string, string>> = {}): string {
  const v = {
    name: 'Pilot Travel Center #404', category: 'Truck Stops', address: '2441 S Church St',
    city: 'Murfreesboro', state: 'TN', zip: '37127', lat: '', lng: '', phone: '615-907-9595',
    website: 'https://example.com', description: 'A verified 24-hour travel center at I-24 Exit 81.',
    truckSpaces: '65', free: 'yes', paid: '', reserved: 'yes', overnight: 'yes', showers: 'yes',
    food: 'yes', fuel: 'yes', laundry: 'yes', restrooms: 'yes', repair: '', cat: 'yes', wifi: 'yes',
    security: '', tpc: '', affiliate: '', image: '', interstate: 'I-24', exit: '81',
    published: 'yes', featured: 'no', ...over,
  };
  return [
    v.name, v.category, v.address, v.city, v.state, v.zip, v.lat, v.lng, v.phone, v.website,
    v.description, v.truckSpaces, v.free, v.paid, v.reserved, v.overnight, v.showers, v.food,
    v.fuel, v.laundry, v.restrooms, v.repair, v.cat, v.wifi, v.security, v.tpc, v.affiliate,
    v.image, v.interstate, v.exit, v.published, v.featured,
  ].join(',');
}
const csv = (...rows: string[]) => [HEADER, ...rows].join('\n');

/* ---------------------- happy path ---------------------- */
{
  const { rows, summary } = prepareImport(csv(row()), new Set());
  check('one valid row imports', summary.imported === 1 && rows.length === 1, summary);
  check('no skips / dupes / errors', summary.skipped === 0 && summary.duplicates === 0 && summary.errors.length === 0);
  const r = rows[0];
  check('category resolved to slug', r.category_slug === 'truck-stops', r.category_slug);
  check('slug derived from name', typeof r.slug === 'string' && (r.slug as string).startsWith('pilot-travel-center'), r.slug);
  check('source tagged csv-import', r.source === 'csv-import');
  check('amenities collected from yes columns', Array.isArray(r.amenities) && (r.amenities as string[]).includes('CAT Scale') && (r.amenities as string[]).includes('Showers'));
  check('empty amenity columns excluded', Array.isArray(r.amenities) && !(r.amenities as string[]).includes('Repair'));
  check('boolean parking parsed', r.free_parking === true && r.overnight_parking === true && r.paid_parking === false);
  check('never auto-indexable on import', r.is_indexable === false);
}

/* ---------------------- category resolution ---------------------- */
{
  // Title form
  check('accepts title "CAT Scales"', prepareImport(csv(row({ category: 'CAT Scales' })), new Set()).summary.imported === 1);
  // Slug form
  check('accepts slug "cat-scales"', prepareImport(csv(row({ category: 'cat-scales' })), new Set()).summary.imported === 1);
  // Unknown → skipped + error, not imported
  const bad = prepareImport(csv(row({ category: 'Rocket Fuel' })), new Set());
  check('unknown category skipped', bad.summary.skipped === 1 && bad.summary.imported === 0);
  check('unknown category reports error', bad.summary.errors.some((e) => /Unknown category/i.test(e.message)));
}

/* ---------------------- validation ---------------------- */
{
  const noName = prepareImport(csv(row({ name: '' })), new Set());
  check('blank name skipped with error', noName.summary.imported === 0 && noName.summary.skipped === 1 && noName.summary.errors.length === 1);

  const noHeaderCols = prepareImport('Foo,Bar\nx,y', new Set());
  check('missing required headers → error, nothing imported', noHeaderCols.rows.length === 0 && noHeaderCols.summary.errors.length === 1);

  const headerOnly = prepareImport(HEADER, new Set());
  check('header only (no data rows) → error', headerOnly.summary.errors.length === 1 && headerOnly.rows.length === 0);
}

/* ---------------------- boolean parsing ---------------------- */
{
  for (const t of ['yes', 'Y', 'true', '1', 'x']) {
    check(`"${t}" is truthy for Published`, prepareImport(csv(row({ published: t })), new Set()).rows[0].is_published === true);
  }
  for (const f of ['no', 'n', 'false', '0', '']) {
    check(`"${f}" is falsy for Published`, prepareImport(csv(row({ published: f })), new Set()).rows[0].is_published === false);
  }
}

/* ---------------------- duplicate detection ---------------------- */
{
  // Same name+city+state twice in the file → second is a duplicate.
  const inFile = prepareImport(csv(row(), row()), new Set());
  check('in-file duplicate collapses to one import', inFile.summary.imported === 1 && inFile.summary.duplicates === 1, inFile.summary);

  // Different city → not a duplicate.
  const diffCity = prepareImport(csv(row(), row({ city: 'Nashville' })), new Set());
  check('same name different city are distinct', diffCity.summary.imported === 2 && diffCity.summary.duplicates === 0);

  // Existing DB key → skipped as duplicate.
  const existing = new Set([importDupKey('Pilot Travel Center #404', 'Murfreesboro', 'TN')]);
  const vsExisting = prepareImport(csv(row()), existing);
  check('matches existing DB key → duplicate', vsExisting.summary.imported === 0 && vsExisting.summary.duplicates === 1);

  // importDupKey normalization: case/punctuation/whitespace-insensitive.
  check('dupKey normalizes case + punctuation', importDupKey('Pilot #404!', 'Murfreesboro', 'tn') === importDupKey('  pilot  404 ', 'murfreesboro', 'TN'));
  check('dupKey state kept separate', importDupKey('X', 'Y', 'TN') !== importDupKey('X', 'Y', 'GA'));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
