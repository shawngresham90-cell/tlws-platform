import { prepareImport, type ImportSummary } from './import';
import { detailSlugBase, uniqueDetailSlug } from './detail-slug';
import { scoreCompleteness } from './completeness';
import { coordinateIssues } from '@/lib/map/geo';
import { classifyPair, type PairListing, type ClassifiedPair } from './colocation';
import { normalizeText } from './duplicates';
import { toCsv, safeCsvCell } from './csv';

/**
 * Expansion-readiness assessment (Milestone 21). Runs a candidate import file
 * through the REAL import parser (same zod gate as production imports), then
 * previews everything the next corridor/state batch needs to know before a
 * single row is created: slug collisions, duplicates against the live
 * directory, completeness, geocoding readiness, and a publication verdict.
 * Pure — no inserts anywhere.
 */

export type ExpansionVerdict =
  | 'ready-to-publish'
  | 'import-unpublished'
  | 'manual-review';

export type ExpansionRow = {
  name: string;
  category: string;
  city: string;
  state: string;
  slugPreview: string;
  slugCollision: boolean;
  completeness: number;
  completenessLabel: string;
  missing: string[];
  geocoding: 'valid-coords' | 'invalid-coords' | 'needs-geocoding';
  duplicateHits: { liveName: string; class: ClassifiedPair['class']; reasons: string[] }[];
  verdict: ExpansionVerdict;
  verdictReason: string;
};

export type ExpansionReport = {
  summary: ImportSummary;
  rows: ExpansionRow[];
  verdictCounts: Record<ExpansionVerdict | 'reject', number>;
};

type PreparedRow = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

function chipsOf(row: PreparedRow): string[] {
  const chips: string[] = [];
  if (row.free_parking) chips.push('Free parking');
  if (row.paid_parking) chips.push('Paid parking');
  if (row.reserved_parking) chips.push('Reserved');
  if (row.overnight_parking) chips.push('Overnight OK');
  if (Array.isArray(row.amenities)) for (const a of row.amenities) if (typeof a === 'string') chips.push(a);
  return chips;
}

export function assessExpansion(
  csvText: string,
  existingKeys: Set<string>,
  existingDetailSlugs: Set<string>,
  live: PairListing[],
): ExpansionReport {
  const { rows: prepared, summary } = prepareImport(csvText, existingKeys);
  const takenSlugs = new Set(existingDetailSlugs);
  const liveByBucket = new Map<string, PairListing[]>();
  for (const l of live) {
    for (const key of [
      `n|${normalizeText(l.name)}|${l.state.toUpperCase()}`,
      `a|${normalizeText(l.address ?? '')}|${normalizeText(l.city)}|${l.state.toUpperCase()}`,
      l.lat != null && l.lng != null ? `c|${l.lat.toFixed(3)}|${l.lng.toFixed(3)}` : '',
    ]) {
      if (!key || key.startsWith('a||')) continue;
      liveByBucket.set(key, [...(liveByBucket.get(key) ?? []), l]);
    }
  }

  const rows: ExpansionRow[] = prepared.map((row, i) => {
    const name = str(row.name);
    const city = str(row.city);
    const state = str(row.state);
    const category = str(row.category_slug);
    const lat = num(row.lat);
    const lng = num(row.lng);

    // Slug preview with in-file + live collision awareness.
    const base = detailSlugBase(name, city, state);
    const slugPreview = uniqueDetailSlug(base, takenSlugs);
    const slugCollision = slugPreview !== base;
    takenSlugs.add(slugPreview);

    // Duplicate check against the live directory (bucketed, then classified).
    const candidate: PairListing = {
      id: `new-${i}`,
      name,
      category,
      address: str(row.address) || null,
      city,
      state,
      phone: str(row.phone) || null,
      website: str(row.website) || null,
      lat: lat ?? null,
      lng: lng ?? null,
      interstate: str(row.interstate) || null,
      exitNumber: str(row.exit_number) || null,
    };
    const nearby = new Set<PairListing>();
    for (const key of [
      `n|${normalizeText(name)}|${state.toUpperCase()}`,
      `a|${normalizeText(candidate.address ?? '')}|${normalizeText(city)}|${state.toUpperCase()}`,
      lat != null && lng != null ? `c|${lat.toFixed(3)}|${lng.toFixed(3)}` : '',
    ]) {
      if (!key || key.startsWith('a||')) continue;
      for (const l of liveByBucket.get(key) ?? []) nearby.add(l);
    }
    const duplicateHits = [...nearby].map((l) => {
      const pair = classifyPair(candidate, l);
      return { liveName: l.name, class: pair.class, reasons: pair.reasons };
    });
    const duplicateSuspect = duplicateHits.some(
      (h) => h.class === 'exact-duplicate' || h.class === 'probable-duplicate',
    );

    const completeness = scoreCompleteness({
      name,
      category,
      address: str(row.address) || undefined,
      city,
      state,
      zip: str(row.zip) || undefined,
      interstate: str(row.interstate) || undefined,
      exitNumber: str(row.exit_number) || undefined,
      lat,
      lng,
      phone: str(row.phone) || undefined,
      website: str(row.website) || undefined,
      amenities: chipsOf(row),
      parkingSpaces: num(row.parking_spaces),
      description: str(row.description) || undefined,
      tpcUrl: str(row.tpc_url) || undefined,
      verifiedAt: row.verified_at ? String(row.verified_at) : undefined,
    });

    const geocoding =
      lat == null || lng == null
        ? 'needs-geocoding'
        : coordinateIssues(lat, lng).length > 0
          ? 'invalid-coords'
          : 'valid-coords';

    let verdict: ExpansionVerdict;
    let verdictReason: string;
    if (duplicateSuspect) {
      verdict = 'manual-review';
      verdictReason = `possible duplicate of ${duplicateHits.find((h) => h.class.includes('duplicate'))?.liveName}`;
    } else if (geocoding === 'invalid-coords') {
      verdict = 'manual-review';
      verdictReason = 'coordinates fail validation';
    } else if (completeness.score >= 65 && str(row.address)) {
      verdict = 'ready-to-publish';
      verdictReason = `completeness ${completeness.score} with address`;
    } else {
      verdict = 'import-unpublished';
      verdictReason = `completeness ${completeness.score}${str(row.address) ? '' : ', no address'} — enrich before publishing`;
    }

    return {
      name,
      category,
      city,
      state,
      slugPreview,
      slugCollision,
      completeness: completeness.score,
      completenessLabel: completeness.label,
      missing: completeness.missing,
      geocoding,
      duplicateHits,
      verdict,
      verdictReason,
    };
  });

  const verdictCounts: ExpansionReport['verdictCounts'] = {
    'ready-to-publish': 0,
    'import-unpublished': 0,
    'manual-review': 0,
    reject: summary.skipped,
  };
  for (const r of rows) verdictCounts[r.verdict] += 1;

  return { summary, rows, verdictCounts };
}

/** Readiness report as a formula-safe CSV. */
export function expansionReportCsv(report: ExpansionReport): string {
  return toCsv([
    ['name', 'category', 'city', 'state', 'slug_preview', 'slug_collision', 'completeness', 'label', 'geocoding', 'duplicate_hits', 'verdict', 'reason', 'missing_fields'],
    ...report.rows.map((r) => [
      safeCsvCell(r.name),
      r.category,
      safeCsvCell(r.city),
      r.state,
      r.slugPreview,
      r.slugCollision ? 'yes' : '',
      r.completeness,
      r.completenessLabel,
      r.geocoding,
      safeCsvCell(r.duplicateHits.map((h) => `${h.liveName} (${h.class})`).join('; ')),
      r.verdict,
      safeCsvCell(r.verdictReason),
      safeCsvCell(r.missing.join('; ')),
    ]),
  ]);
}

/** Import template with every supported header, ready to fill. */
export function expansionTemplateCsv(): string {
  return toCsv([
    [
      'Business Name', 'Category', 'Address', 'City', 'State', 'Zip', 'Latitude', 'Longitude',
      'Phone', 'Website', 'Description', 'Truck Spaces', 'Free Parking', 'Paid Parking',
      'Reserved Parking', 'Overnight Parking', 'Showers', 'Food', 'Fuel', 'Laundry', 'Restrooms',
      'Repair', 'CAT Scale', 'WiFi', 'Security', 'Truck Parking Club URL', 'Interstate',
      'Exit Number', 'Published', 'Featured',
    ],
  ]);
}
