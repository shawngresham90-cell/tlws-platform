import { findDuplicatePairs, normalizeText, orderPair, type DupCandidate } from './duplicates';
import { haversineMiles } from '@/lib/map/geo';
import { toCsv, safeCsvCell } from './csv';

/**
 * Pair classification (Milestone 21): turns raw "these two rows look alike"
 * pairs into a deterministic verdict a human can act on — true duplicates vs
 * the many LEGITIMATE reasons two listings share data (co-located businesses,
 * a scale inside a truck stop, the same brand at different exits).
 *
 * Scoring weights (documented, asserted by tests; capped at 100):
 *   exact name 35 · similar name 20 · exact address 25 · coords ≤150 m 20 ·
 *   same phone 15 · same website host 10 · same category 5 · same exit 5 ·
 *   same city/state 5
 */

export type PairClass =
  | 'exact-duplicate'
  | 'probable-duplicate'
  | 'shared-address-sub-service'
  | 'same-coords-diff-category'
  | 'co-located'
  | 'brand-multi-exit'
  | 'similar-name-diff-address';

/** Classes that are NOT defects — legitimate real-world arrangements. */
export const LEGITIMATE_CLASSES: ReadonlySet<PairClass> = new Set([
  'shared-address-sub-service',
  'same-coords-diff-category',
  'co-located',
  'brand-multi-exit',
]);

export type PairListing = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  city: string;
  state: string;
  phone: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
  interstate: string | null;
  exitNumber: string | null;
};

export type ClassifiedPair = {
  aId: string;
  bId: string;
  class: PairClass;
  score: number;
  reasons: string[];
};

const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');

function websiteHost(url: string | null | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Brand key: name minus store numbers and separators ("Pilot #45" → "pilot"). */
export function brandKey(name: string): string {
  return normalizeText(name.replace(/#\s*\d+/g, '').replace(/—|–/g, ' '))
    .split(' ')
    .filter((t) => t.length > 1)
    .slice(0, 4)
    .join(' ');
}

/** Token-overlap similarity in [0, 1] over normalized name tokens. */
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeText(a).split(' ').filter(Boolean));
  const tb = new Set(normalizeText(b).split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / Math.min(ta.size, tb.size);
}

const COORDS_CLOSE_MILES = 0.1; // ~150 m

export function classifyPair(a: PairListing, b: PairListing): ClassifiedPair {
  const reasons: string[] = [];
  let score = 0;

  const nameExact = normalizeText(a.name) === normalizeText(b.name);
  const similarity = nameSimilarity(a.name, b.name);
  const nameSimilar = !nameExact && similarity >= 0.6;
  const sameBrand = brandKey(a.name) !== '' && brandKey(a.name) === brandKey(b.name);
  const addressExact =
    Boolean(a.address && b.address) &&
    normalizeText(a.address!) === normalizeText(b.address!) &&
    normalizeText(a.city) === normalizeText(b.city) &&
    a.state.toUpperCase() === b.state.toUpperCase();
  const coordsClose =
    a.lat != null &&
    a.lng != null &&
    b.lat != null &&
    b.lng != null &&
    haversineMiles({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) <= COORDS_CLOSE_MILES;
  const samePhone = digits(a.phone).length >= 10 && digits(a.phone) === digits(b.phone);
  const sameWebsite = websiteHost(a.website) !== '' && websiteHost(a.website) === websiteHost(b.website);
  const sameCategory = (a.category ?? '') === (b.category ?? '');
  const sameExit =
    Boolean(a.interstate && a.exitNumber) &&
    a.interstate === b.interstate &&
    (a.exitNumber ?? '') === (b.exitNumber ?? '');
  const sameCityState =
    normalizeText(a.city) === normalizeText(b.city) && a.state.toUpperCase() === b.state.toUpperCase();

  if (nameExact) {
    score += 35;
    reasons.push('identical name');
  } else if (nameSimilar) {
    score += 20;
    reasons.push(`similar name (${Math.round(similarity * 100)}% token overlap)`);
  }
  if (addressExact) {
    score += 25;
    reasons.push('identical address');
  }
  if (coordsClose) {
    score += 20;
    reasons.push('coordinates within ~150 m');
  }
  if (samePhone) {
    score += 15;
    reasons.push('same phone');
  }
  if (sameWebsite) {
    score += 10;
    reasons.push('same website');
  }
  if (sameCategory) {
    score += 5;
    reasons.push('same category');
  }
  if (sameExit) {
    score += 5;
    reasons.push('same exit');
  }
  if (sameCityState) {
    score += 5;
    reasons.push('same city/state');
  }
  score = Math.min(score, 100);

  const samePlace = addressExact || coordsClose;
  let cls: PairClass;
  if (sameCategory && nameExact && samePlace) {
    cls = 'exact-duplicate';
  } else if (sameCategory && (samePlace || samePhone) && (nameExact || nameSimilar || sameBrand)) {
    cls = 'probable-duplicate';
  } else if (sameCategory && nameExact && sameCityState) {
    cls = 'probable-duplicate';
  } else if (!sameCategory && addressExact && (nameSimilar || sameBrand || similarity >= 0.3)) {
    cls = 'shared-address-sub-service';
  } else if (!sameCategory && coordsClose && !addressExact) {
    cls = 'same-coords-diff-category';
  } else if (!sameCategory && samePlace) {
    cls = 'co-located';
  } else if ((nameExact || sameBrand) && !samePlace && (a.exitNumber ?? '') !== (b.exitNumber ?? '')) {
    cls = 'brand-multi-exit';
  } else if ((nameExact || nameSimilar) && !samePlace) {
    cls = 'similar-name-diff-address';
  } else {
    cls = 'co-located';
  }

  const { a: aId, b: bId } = orderPair(a.id, b.id);
  return { aId, bId, class: cls, score, reasons };
}

/**
 * Find + classify candidate pairs. Extends the bucketed finder with
 * phone-digit and website-host buckets so shared contact details also
 * surface, then classifies every unique pair. `excluded` are pair keys
 * ("a|b", a < b) already decided by an admin.
 */
export function findClassifiedPairs(
  rows: PairListing[],
  excluded: Set<string> = new Set(),
  maxPairs = 200,
): ClassifiedPair[] {
  const base = findDuplicatePairs(
    rows.map(
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
    excluded,
    maxPairs,
  );
  const keys = new Set(base.map((p) => `${p.aId}|${p.bId}`));

  // Contact-detail buckets (same phone / same website host).
  const addPair = (x: string, y: string) => {
    if (x === y) return;
    const { a, b } = orderPair(x, y);
    const key = `${a}|${b}`;
    if (excluded.has(key) || keys.has(key)) return;
    if (keys.size >= maxPairs) return;
    keys.add(key);
  };
  const byPhone = new Map<string, string[]>();
  const byHost = new Map<string, string[]>();
  for (const r of rows) {
    const p = digits(r.phone);
    if (p.length >= 10) byPhone.set(p, [...(byPhone.get(p) ?? []), r.id]);
    const h = websiteHost(r.website);
    if (h) byHost.set(h, [...(byHost.get(h) ?? []), r.id]);
  }
  for (const bucket of byPhone.values()) {
    if (bucket.length < 2 || bucket.length > 20) continue;
    for (let i = 0; i < bucket.length; i++)
      for (let j = i + 1; j < bucket.length; j++) addPair(bucket[i], bucket[j]);
  }
  // Website hosts are chain-wide (every Pilot shares pilotflyingj.com) — only
  // pair them within the same city to avoid flagging a whole brand.
  const cityOf = new Map(rows.map((r) => [r.id, normalizeText(r.city)]));
  for (const bucket of byHost.values()) {
    if (bucket.length < 2 || bucket.length > 20) continue;
    for (let i = 0; i < bucket.length; i++)
      for (let j = i + 1; j < bucket.length; j++)
        if (cityOf.get(bucket[i]) === cityOf.get(bucket[j])) addPair(bucket[i], bucket[j]);
  }

  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: ClassifiedPair[] = [];
  for (const key of keys) {
    const [aId, bId] = key.split('|');
    const a = byId.get(aId);
    const b = byId.get(bId);
    if (!a || !b) continue;
    out.push(classifyPair(a, b));
  }
  return out.sort((x, y) => y.score - x.score);
}

/** Classified pairs as a formula-safe CSV export. */
export function classifiedPairsCsv(pairs: ClassifiedPair[], byId: Map<string, PairListing>): string {
  return toCsv([
    ['a_id', 'a_name', 'b_id', 'b_name', 'class', 'score', 'reasons'],
    ...pairs.map((p) => [
      p.aId,
      safeCsvCell(byId.get(p.aId)?.name ?? ''),
      p.bId,
      safeCsvCell(byId.get(p.bId)?.name ?? ''),
      p.class,
      p.score,
      safeCsvCell(p.reasons.join('; ')),
    ]),
  ]);
}
