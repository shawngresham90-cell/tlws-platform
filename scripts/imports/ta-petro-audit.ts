/**
 * TA/Petro official-operator import AUDIT (read-only, pure analysis).
 *
 * Maps the operator's location master into the directory schema, normalizes
 * states/amenities, and deduplicates against a read-only production snapshot on
 * three independent signals (canonical dup key, address, coordinate proximity).
 *
 * Reuses the canonical vocabularies and helpers — importDupKey / normalizeText /
 * listingSchema (via prepareImport) / DIRECTORY_STATES / AMENITIES /
 * haversineMiles — and forks none of them. It NEVER writes to the database and
 * never modifies the source workbook.
 */
import { normalizeText } from '@/lib/directory/duplicates';
import { importDupKey } from '@/lib/directory/import';
import { DIRECTORY_STATES } from '@/lib/directory/states';
import { AMENITIES } from '@/lib/directory/amenities';
import { haversineMiles } from '@/lib/map/geo';

export type WorkbookRow = Record<string, unknown>;

export type ProdRow = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  type: string;
};

/** Verdicts this audit emits — one per source row. */
export type Verdict =
  | 'existing-match'
  | 'probable-duplicate'
  | 'net-new-candidate'
  | 'rejected-or-ambiguous';

export type MappedRow = {
  siteId: string;
  brand: string;
  name: string;
  category: string;
  address: string;
  city: string;
  state: string; // normalized USPS
  zip: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  parkingSpaces: number | null;
  amenities: string[];
  scalePresent: boolean; // operator says a weigh scale exists (NOT asserted as CAT Scale)
  showerCount: number | null;
  serviceBays: number | null;
  dieselLanes: number | null;
  foodBrands: string;
  truckWash: string;
  verdict: Verdict;
  reasons: string[];
  matchedId: string;
  matchedName: string;
  matchDistanceMiles: number | null;
};

const STATE_BY_NAME = new Map(DIRECTORY_STATES.map((s) => [s.name.toLowerCase(), s.code]));
const STATE_CODES = new Set(DIRECTORY_STATES.map((s) => s.code));

/** Full state name or code → USPS code, or '' when unrecognized. */
export function normalizeState(v: string): string {
  const t = (v ?? '').trim();
  if (!t) return '';
  if (/^[A-Za-z]{2}$/.test(t) && STATE_CODES.has(t.toUpperCase())) return t.toUpperCase();
  return STATE_BY_NAME.get(t.toLowerCase()) ?? '';
}

/** TA brands that are unambiguously truck stops / travel centers. */
const CORE_BRANDS = new Set(['TA', 'PETRO', 'TA EXPRESS']);

const s = (v: unknown): string => (v == null ? '' : String(v).trim());
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const isY = (v: unknown): boolean => s(v).toLowerCase() === 'y';

/**
 * Map amenities CONSERVATIVELY from operator columns to the canonical nine.
 * Anything the workbook does not state is left unset — no inference. Notably
 * the workbook has NO Wi-Fi data (both Wi-Fi columns are empty on all 354
 * rows), no Restrooms column, and no Security column, so those three canonical
 * amenities are never set. The 'Weigh Scale' column is recorded separately as
 * `scalePresent` rather than asserted as the branded 'CAT Scale' amenity.
 */
export function mapAmenities(r: WorkbookRow): string[] {
  const out: string[] = [];
  if ((num(r['Showers']) ?? 0) > 0) out.push('Showers');
  if (s(r['Full Service Restaurant']) || s(r['QSR(s)'])) out.push('Food');
  if ((num(r['Total Diesel Dispensers/Lanes']) ?? 0) > 0) out.push('Fuel');
  if (isY(r['Laundry Room'])) out.push('Laundry');
  const repair =
    (num(r['Service Bays']) ?? 0) > 0 ||
    (num(r['Service Pits']) ?? 0) > 0 ||
    isY(r['Tire Services']) ||
    isY(r['Brake Svc']) ||
    isY(r['Oil Changes']) ||
    isY(r['Engine Diagnostics']) ||
    isY(r['Preventative Maintenance']) ||
    isY(r['Standard Services']);
  if (repair) out.push('Repair');
  // Validate against the canonical vocabulary — never emit an unknown amenity.
  return out.filter((a) => (AMENITIES as readonly string[]).includes(a));
}

/** Map one workbook row into the directory schema shape. */
export function mapRow(
  r: WorkbookRow,
): Omit<MappedRow, 'verdict' | 'reasons' | 'matchedId' | 'matchedName' | 'matchDistanceMiles'> {
  const brand = s(r['Brand']);
  const zipRaw = s(r['Zipcode']);
  return {
    siteId: s(r['Site ID']),
    brand,
    name: s(r['Location']),
    category: 'truck-stops',
    address: s(r['Address']),
    city: s(r['City']),
    state: normalizeState(s(r['State'])),
    zip: zipRaw,
    phone: s(r['Phone']),
    lat: num(r['Latitude']),
    lng: num(r['Longitude']),
    parkingSpaces: num(r['Truck Parking Spaces']),
    amenities: mapAmenities(r),
    scalePresent: (num(r['Weigh Scale']) ?? 0) > 0,
    showerCount: num(r['Showers']),
    serviceBays: num(r['Service Bays']),
    dieselLanes: num(r['Total Diesel Dispensers/Lanes']),
    foodBrands: [s(r['Full Service Restaurant']), s(r['QSR(s)'])].filter(Boolean).join('; '),
    truckWash: s(r['Truck Wash']),
  };
}

/** Brand tokens that indicate a production row is the same operator. */
const TA_TOKENS = ['ta ', 'petro', 'travelcenters', 'travel centers of america', 'goasis'];

function looksLikeSameOperator(prodName: string): boolean {
  const n = ` ${normalizeText(prodName)} `;
  return TA_TOKENS.some((t) => n.includes(t.trim() === 'ta' ? ' ta ' : t));
}

const PROXIMITY_MILES = 0.25;

/**
 * Classify every mapped row against the production snapshot.
 * - existing-match: canonical importDupKey hit (the importer would drop it)
 * - probable-duplicate: same address+city+state, or same-operator name in the
 *   same city/state, or a coordinate within 0.25 mi of a same-operator row
 * - rejected-or-ambiguous: unusable/unmappable, or a non-core brand needing a
 *   human category decision
 * - net-new-candidate: everything else
 */
export function auditRows(wbRows: WorkbookRow[], prod: ProdRow[]): MappedRow[] {
  const byDupKey = new Map<string, ProdRow>();
  const byAddr = new Map<string, ProdRow>();
  for (const p of prod) {
    byDupKey.set(importDupKey(p.name, p.city, p.state), p);
    if (p.address) {
      byAddr.set(`${normalizeText(p.address)}|${normalizeText(p.city)}|${p.state}`, p);
    }
  }
  const prodWithCoords = prod.filter((p) => p.lat != null && p.lng != null);
  const seenInFile = new Map<string, number>();

  return wbRows.map((raw, idx) => {
    const m = mapRow(raw);
    const reasons: string[] = [];
    let verdict: Verdict = 'net-new-candidate';
    let matchedId = '',
      matchedName = '';
    let matchDistanceMiles: number | null = null;

    // ---- hard rejections / ambiguity first
    if (!m.name) reasons.push('missing-name');
    if (!m.address) reasons.push('missing-address');
    if (!m.city) reasons.push('missing-city');
    if (!m.state) reasons.push(`unrecognized-state:${s(raw['State'])}`);
    if (m.lat == null || m.lng == null) reasons.push('missing-coordinates');
    if (m.zip && !/^\d{5}(-\d{4})?$/.test(m.zip)) reasons.push(`malformed-zip:${m.zip}`);
    if (!CORE_BRANDS.has(m.brand.toUpperCase())) {
      reasons.push(`non-core-brand-needs-category-review:${m.brand}`);
    }

    // in-file duplicate (same operator site listed twice)
    const fileKey = importDupKey(m.name, m.city, m.state);
    const firstIdx = seenInFile.get(fileKey);
    if (firstIdx != null) reasons.push(`duplicate-within-workbook-of-row:${firstIdx + 1}`);
    else seenInFile.set(fileKey, idx);

    if (reasons.length > 0) {
      verdict = 'rejected-or-ambiguous';
    } else {
      // ---- signal 1: canonical dup key
      const exact = byDupKey.get(fileKey);
      if (exact) {
        verdict = 'existing-match';
        reasons.push('dup-key-name|city|state');
        matchedId = exact.id;
        matchedName = exact.name;
      } else {
        // ---- signal 2: same normalized address+city+state
        const addrHit = m.address
          ? byAddr.get(`${normalizeText(m.address)}|${normalizeText(m.city)}|${m.state}`)
          : undefined;
        // ---- signal 3: coordinate proximity to a same-operator production row
        let near: ProdRow | undefined;
        if (m.lat != null && m.lng != null) {
          for (const p of prodWithCoords) {
            if (p.state !== m.state) continue;
            const d = haversineMiles({ lat: m.lat, lng: m.lng }, { lat: p.lat!, lng: p.lng! });
            if (d <= PROXIMITY_MILES && looksLikeSameOperator(p.name)) {
              if (matchDistanceMiles == null || d < matchDistanceMiles) {
                matchDistanceMiles = d;
                near = p;
              }
            }
          }
        }
        // ---- signal 4: same-operator name in same city+state
        const sameCityOperator = prod.find(
          (p) =>
            p.state === m.state &&
            normalizeText(p.city) === normalizeText(m.city) &&
            looksLikeSameOperator(p.name),
        );

        if (addrHit) {
          verdict = 'probable-duplicate';
          reasons.push('same-address|city|state');
          matchedId = addrHit.id;
          matchedName = addrHit.name;
        } else if (near) {
          verdict = 'probable-duplicate';
          reasons.push(`coordinate-within-${PROXIMITY_MILES}mi-same-operator`);
          matchedId = near.id;
          matchedName = near.name;
        } else if (sameCityOperator) {
          verdict = 'probable-duplicate';
          reasons.push('same-operator-name-in-city|state');
          matchedId = sameCityOperator.id;
          matchedName = sameCityOperator.name;
        } else {
          reasons.push('no-production-match');
        }
      }
    }

    return { ...m, verdict, reasons, matchedId, matchedName, matchDistanceMiles };
  });
}
