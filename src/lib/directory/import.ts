import { listingSchema, toRow, slugify, dbTypeFor } from './admin';
import { DIRECTORY_CATEGORIES } from './categories';
import { parseCsv } from './csv';
import { normalizeText } from './duplicates';

/**
 * CSV import pipeline (Milestone 13): header mapping → per-row zod
 * validation (the SAME listingSchema the admin form uses — one gate for all
 * writes) → duplicate detection within the file and against existing rows →
 * insertable rows + a summary. Pure of I/O: the server action feeds it text
 * and existing-row keys, gets back rows to insert.
 */

export const IMPORT_LIMITS = {
  maxBytes: 4 * 1024 * 1024, // Netlify function-friendly
  maxRows: 10000,
};

/** Spec headers → canonical field keys. Matching is case/space/punct-insensitive. */
const HEADER_MAP: Record<string, string> = {
  businessname: 'name',
  name: 'name',
  category: 'category',
  address: 'address',
  city: 'city',
  state: 'state',
  zip: 'zip',
  zipcode: 'zip',
  latitude: 'lat',
  lat: 'lat',
  longitude: 'lng',
  lng: 'lng',
  phone: 'phone',
  website: 'website',
  description: 'description',
  truckspaces: 'parking_spaces',
  freeparking: 'free_parking',
  paidparking: 'paid_parking',
  reservedparking: 'reserved_parking',
  overnightparking: 'overnight_parking',
  showers: 'am_Showers',
  food: 'am_Food',
  restaurant: 'am_Food',
  fuel: 'am_Fuel',
  laundry: 'am_Laundry',
  restrooms: 'am_Restrooms',
  repair: 'am_Repair',
  catscale: 'am_CAT Scale',
  wifi: 'am_Wi-Fi',
  security: 'am_Security',
  truckparkingcluburl: 'tpc_url',
  tpcurl: 'tpc_url',
  affiliatecode: 'affiliate_code',
  imageurl: 'image_url',
  published: 'is_published',
  featured: 'is_featured',
  interstate: 'interstate',
  exitnumber: 'exit_number',
};

const TRUE_VALUES = new Set(['yes', 'y', 'true', '1', 'x']);

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function asBool(v: string | undefined): boolean {
  return TRUE_VALUES.has((v ?? '').trim().toLowerCase());
}

/** Category cell accepts the display title ("Truck Parking") or the slug. */
function resolveCategory(value: string): string | null {
  const v = value.trim().toLowerCase();
  const hit = DIRECTORY_CATEGORIES.find(
    (c) => c.slug === v || c.title.toLowerCase() === v,
  );
  return hit?.slug ?? null;
}

/** Key used to consider two listings "the same" for import purposes. */
export function importDupKey(name: string, city: string, state: string): string {
  return `${normalizeText(name)}|${normalizeText(city)}|${state.trim().toUpperCase()}`;
}

export type ImportRowError = { row: number; message: string };

export type ImportSummary = {
  totalRows: number;
  imported: number;
  skipped: number;
  duplicates: number;
  errors: ImportRowError[];
};

export type PreparedImport = {
  rows: Record<string, unknown>[];
  summary: ImportSummary;
};

/**
 * Parse + validate + dedupe a CSV. `existingKeys` are importDupKey()s of rows
 * already in the database. Returned summary.imported counts prepared rows —
 * the caller decrements/reports if a database insert later fails.
 */
export function prepareImport(csvText: string, existingKeys: Set<string>): PreparedImport {
  const summary: ImportSummary = {
    totalRows: 0,
    imported: 0,
    skipped: 0,
    duplicates: 0,
    errors: [],
  };
  const MAX_ERRORS = 50;
  const pushError = (row: number, message: string) => {
    if (summary.errors.length < MAX_ERRORS) summary.errors.push({ row, message });
  };

  const grid = parseCsv(csvText);
  if (grid.length < 2) {
    pushError(1, 'File needs a header row and at least one data row.');
    return { rows: [], summary };
  }

  const headers = grid[0].map(normHeader).map((h) => HEADER_MAP[h] ?? null);
  if (!headers.includes('name') || !headers.includes('category')) {
    pushError(1, 'Header row must include at least "Business Name" and "Category".');
    return { rows: [], summary };
  }

  const seenInFile = new Set<string>();
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < grid.length; i++) {
    const rowNum = i + 1; // 1-based, counting the header
    summary.totalRows++;

    const cells = grid[i];
    const raw: Record<string, string> = {};
    const amenities: string[] = [];
    headers.forEach((field, col) => {
      if (!field) return;
      const value = (cells[col] ?? '').trim();
      if (field.startsWith('am_')) {
        if (asBool(value)) amenities.push(field.slice(3));
      } else {
        raw[field] = value;
      }
    });

    const categorySlug = resolveCategory(raw.category ?? '');
    if (!categorySlug) {
      summary.skipped++;
      pushError(rowNum, `Unknown category "${raw.category ?? ''}"`);
      continue;
    }

    const parsed = listingSchema.safeParse({
      name: raw.name ?? '',
      category_slug: categorySlug,
      address: raw.address ?? '',
      city: raw.city ?? '',
      state: raw.state ?? '',
      zip: raw.zip ?? '',
      lat: raw.lat ?? '',
      lng: raw.lng ?? '',
      phone: raw.phone ?? '',
      website: raw.website ?? '',
      description: raw.description ?? '',
      free_parking: asBool(raw.free_parking),
      paid_parking: asBool(raw.paid_parking),
      reserved_parking: asBool(raw.reserved_parking),
      overnight_parking: asBool(raw.overnight_parking),
      parking_spaces: raw.parking_spaces ?? '',
      amenities,
      tpc_url: raw.tpc_url ?? '',
      affiliate_code: raw.affiliate_code ?? '',
      image_url: raw.image_url ?? '',
      interstate: raw.interstate ?? '',
      exit_number: raw.exit_number ?? '',
      is_published: asBool(raw.is_published),
      is_featured: asBool(raw.is_featured),
      is_indexable: false, // SEO inclusion stays a deliberate per-listing admin decision
      verified_on: undefined,
    });

    if (!parsed.success) {
      summary.skipped++;
      const issue = parsed.error.issues[0];
      pushError(rowNum, `${issue.path.join('.') || 'row'}: ${issue.message}`);
      continue;
    }

    const key = importDupKey(parsed.data.name, parsed.data.city, parsed.data.state);
    if (existingKeys.has(key) || seenInFile.has(key)) {
      summary.duplicates++;
      continue;
    }
    seenInFile.add(key);

    rows.push({
      ...toRow(parsed.data),
      type: dbTypeFor(parsed.data.category_slug),
      slug: slugify(parsed.data.name),
      source: 'csv-import',
    });
    summary.imported++;
  }

  return { rows, summary };
}
