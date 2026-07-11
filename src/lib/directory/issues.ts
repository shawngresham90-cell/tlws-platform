import { coordinateIssues } from '@/lib/map/geo';
import { findDuplicatePairs, normalizeText, type DupCandidate } from './duplicates';
import { detailSlugBase } from './detail-slug';
import { isTpcCandidate, validateTpcUrl } from './tpc';
import { getCategory } from './categories';
import { STALE_DAYS } from './trust';
import { toCsv, safeCsvCell } from './csv';

/**
 * Data-quality issue detection (Milestone 21). Pure detectors over the full
 * listing set — every issue carries a type, severity, human detail, and a
 * suggested action, and the whole report serializes to a formula-safe CSV.
 * Detection never mutates anything; the dashboard renders what this returns.
 */

export type QualityListing = {
  id: string;
  name: string;
  categorySlug: string | null;
  address: string | null;
  city: string;
  state: string;
  zip: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  amenities: string[];
  interstate: string | null;
  exitNumber: string | null;
  lat: number | null;
  lng: number | null;
  tpcUrl: string | null;
  detailSlug: string | null;
  published: boolean;
  deleted: boolean;
  verifiedAt: string | null;
  parkingSpaces: number | null;
  freeParking: boolean;
  paidParking: boolean;
  reservedParking: boolean;
  overnightParking: boolean;
};

export type IssueSeverity = 'high' | 'medium' | 'low' | 'info';

export type QualityIssue = {
  listingId: string;
  name: string;
  published: boolean;
  category: string | null;
  city: string;
  state: string;
  type: string;
  severity: IssueSeverity;
  detail: string;
  suggestedAction: string;
};

const PHONE_OK = /^[0-9()+.\-\s ext]{7,30}$/i;

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Fields whose absence is an issue, with severity depending on publish state. */
function missingFieldIssues(row: QualityListing): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const base = {
    listingId: row.id,
    name: row.name,
    published: row.published,
    category: row.categorySlug,
    city: row.city,
    state: row.state,
  };
  const missing = (
    type: string,
    severity: IssueSeverity,
    detail: string,
    suggestedAction: string,
  ) => issues.push({ ...base, type, severity, detail, suggestedAction });

  if (!row.categorySlug || !getCategory(row.categorySlug)) {
    missing('missing-category', 'high', 'No recognized directory category', 'Pick a category in the editor');
  }
  if (!row.address) {
    missing(
      'missing-address',
      row.published ? 'high' : 'medium',
      'No street address',
      'Add the address (also required for indexing)',
    );
  }
  if (!row.zip) missing('missing-zip', 'low', 'No ZIP code', 'Add the ZIP');
  const isPlace = row.categorySlug === 'weigh-stations';
  if (!row.phone && !isPlace) missing('missing-phone', 'medium', 'No phone number', 'Add a phone number');
  if (!row.website && !isPlace) missing('missing-website', 'low', 'No website', 'Add the website');
  if (!row.interstate) missing('missing-interstate', 'low', 'No interstate', 'Set the interstate if it serves one');
  if (row.interstate && !row.exitNumber) {
    missing('missing-exit', 'low', 'Interstate set but no exit number', 'Add the exit number');
  }
  if (row.amenities.length === 0 && !isPlace) {
    missing('missing-amenities', 'low', 'No amenities recorded', 'Record amenities drivers care about');
  }
  if (!row.description || row.description.trim().length < 20) {
    missing('missing-description', 'low', 'No usable description', 'Write a short driver-focused description');
  }
  if (row.lat == null || row.lng == null) {
    missing('missing-coordinates', 'medium', 'No verified coordinates', 'Queue for a geocoding batch');
  }
  return issues;
}

function malformedFieldIssues(row: QualityListing): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const base = {
    listingId: row.id,
    name: row.name,
    published: row.published,
    category: row.categorySlug,
    city: row.city,
    state: row.state,
  };
  if (row.phone && !PHONE_OK.test(row.phone.trim())) {
    issues.push({
      ...base,
      type: 'malformed-phone',
      severity: 'high',
      detail: `Phone "${row.phone}" does not look like a phone number`,
      suggestedAction: 'Fix the phone number',
    });
  }
  if (row.website && !isHttpUrl(row.website)) {
    issues.push({
      ...base,
      type: 'malformed-website',
      severity: 'high',
      detail: `Website "${row.website}" is not a valid http(s) URL`,
      suggestedAction: 'Fix or remove the website URL',
    });
  }
  if (row.tpcUrl && !validateTpcUrl(row.tpcUrl).ok) {
    issues.push({
      ...base,
      type: 'malformed-tpc-url',
      severity: 'high',
      detail: `TPC URL "${row.tpcUrl}" fails validation: ${(validateTpcUrl(row.tpcUrl) as { reason: string }).reason}`,
      suggestedAction: 'Fix it on the Truck Parking Club page',
    });
  }
  const halfCoords = (row.lat == null) !== (row.lng == null);
  if (halfCoords) {
    issues.push({
      ...base,
      type: 'malformed-coordinates',
      severity: 'high',
      detail: 'Only one of lat/lng is set',
      suggestedAction: 'Clear or complete the coordinate pair',
    });
  } else if (row.lat != null && row.lng != null) {
    const problems = coordinateIssues(row.lat, row.lng);
    if (problems.length > 0) {
      issues.push({
        ...base,
        type: 'malformed-coordinates',
        severity: 'high',
        detail: `Coordinate checks failed: ${problems.join(', ')}`,
        suggestedAction: 'Re-verify via the geocoding workflow',
      });
    }
  }
  return issues;
}

function slugIssues(row: QualityListing): QualityIssue[] {
  if (!row.detailSlug) return [];
  const base = detailSlugBase(row.name, row.city, row.state);
  const inSync = row.detailSlug === base || new RegExp(`^${base}-\\d+$`).test(row.detailSlug);
  if (inSync) return [];
  return [
    {
      listingId: row.id,
      name: row.name,
      published: row.published,
      category: row.categorySlug,
      city: row.city,
      state: row.state,
      type: 'stale-slug',
      severity: 'medium',
      detail: `Public URL slug "${row.detailSlug}" no longer matches the listing's name/city/state`,
      suggestedAction: 'Review; regenerate via the editor only if the old URL is misleading',
    },
  ];
}

function verificationIssues(row: QualityListing, now: Date): QualityIssue[] {
  if (!row.verifiedAt) return [];
  const age = (now.getTime() - new Date(row.verifiedAt).getTime()) / 86_400_000;
  if (age <= STALE_DAYS) return [];
  return [
    {
      listingId: row.id,
      name: row.name,
      published: row.published,
      category: row.categorySlug,
      city: row.city,
      state: row.state,
      type: 'stale-verification',
      severity: 'low',
      detail: `Last verified ${Math.floor(age)} days ago`,
      suggestedAction: 'Re-verify the listing details',
    },
  ];
}

/** Indexability heuristic mirror (address + 2 substance signals). */
export function isThinListing(row: QualityListing): boolean {
  if (!row.published) return false;
  if (!row.address) return true;
  let signals = 0;
  if (row.phone) signals += 1;
  if (row.website) signals += 1;
  if ((row.description ?? '').trim().length >= 30) signals += 1;
  if (row.amenities.length >= 1 || row.freeParking || row.paidParking || row.reservedParking || row.overnightParking) signals += 1;
  if (row.lat != null && row.lng != null) signals += 1;
  if (row.parkingSpaces != null) signals += 1;
  return signals < 2;
}

/**
 * The full issue report. Duplicate detection reuses the bucketed pair finder;
 * pairs whose two sides share a category are duplicate suspects, pairs at the
 * same address/coordinates with DIFFERENT categories are possible legitimate
 * co-locations (info severity, not a defect).
 */
export function detectIssues(rows: QualityListing[], now: Date): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const active = rows.filter((r) => !r.deleted);

  for (const row of active) {
    issues.push(...missingFieldIssues(row));
    issues.push(...malformedFieldIssues(row));
    issues.push(...slugIssues(row));
    issues.push(...verificationIssues(row, now));
    if (isThinListing(row)) {
      issues.push({
        listingId: row.id,
        name: row.name,
        published: row.published,
        category: row.categorySlug,
        city: row.city,
        state: row.state,
        type: 'thin-listing',
        severity: 'medium',
        detail: 'Published but too thin to index (noindex until data fills in)',
        suggestedAction: 'Add address/contact/amenity data',
      });
    }
    if (isTpcCandidate({ name: row.name, category: row.categorySlug, tpcUrl: row.tpcUrl })) {
      issues.push({
        listingId: row.id,
        name: row.name,
        published: row.published,
        category: row.categorySlug,
        city: row.city,
        state: row.state,
        type: 'tpc-candidate',
        severity: 'info',
        detail: 'Parking-related listing without a Truck Parking Club URL',
        suggestedAction: 'Research the real TPC URL (never guess) via the TPC page',
      });
    }
  }

  const byId = new Map(active.map((r) => [r.id, r]));
  const pairs = findDuplicatePairs(
    active.map(
      (r): DupCandidate => ({
        id: r.id,
        name: r.name,
        address: r.address,
        city: r.city,
        state: r.state,
        lat: r.lat,
        lng: r.lng,
      }),
    ),
  );
  for (const pair of pairs) {
    const a = byId.get(pair.aId);
    const b = byId.get(pair.bId);
    if (!a || !b) continue;
    const sameCategory = (a.categorySlug ?? '') === (b.categorySlug ?? '');
    const sameName = normalizeText(a.name) === normalizeText(b.name);
    const type = sameCategory && sameName ? 'duplicate-suspect' : 'possible-co-location';
    const severity: IssueSeverity = type === 'duplicate-suspect' ? 'medium' : 'info';
    for (const row of [a, b]) {
      issues.push({
        listingId: row.id,
        name: row.name,
        published: row.published,
        category: row.categorySlug,
        city: row.city,
        state: row.state,
        type,
        severity,
        detail:
          type === 'duplicate-suspect'
            ? `Matches "${(row.id === a.id ? b : a).name}" on ${pair.reasons.join(' + ')}`
            : `Shares ${pair.reasons.join(' + ')} with "${(row.id === a.id ? b : a).name}" (different ${sameCategory ? 'name' : 'category'})`,
        suggestedAction:
          type === 'duplicate-suspect'
            ? 'Review on the Duplicates page (merge or mark false positive)'
            : 'Review on the Duplicates page (likely legitimate co-location)',
      });
    }
  }

  return issues;
}

const SEVERITY_ORDER: Record<IssueSeverity, number> = { high: 0, medium: 1, low: 2, info: 3 };

export function sortIssues(issues: QualityIssue[]): QualityIssue[] {
  return [...issues].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.type.localeCompare(b.type) ||
      a.name.localeCompare(b.name),
  );
}

/** Issue report as a downloadable, formula-safe CSV. */
export function issuesCsv(issues: QualityIssue[]): string {
  return toCsv([
    ['listing_id', 'name', 'published', 'category', 'city', 'state', 'issue', 'severity', 'detail', 'suggested_action'],
    ...sortIssues(issues).map((i) => [
      i.listingId,
      safeCsvCell(i.name),
      i.published ? 'yes' : 'no',
      i.category ?? '',
      safeCsvCell(i.city),
      i.state,
      i.type,
      i.severity,
      safeCsvCell(i.detail),
      safeCsvCell(i.suggestedAction),
    ]),
  ]);
}
