import type { DirectoryEntry } from './types';
import { getCategory } from './categories';

/**
 * Query understanding + relevance ranking for the public directory search
 * (Search & Revenue Optimization milestone). Pure and dependency-free:
 *
 * - Interstate aliases: "I40", "I 40", "Interstate 40" → the canonical
 *   "i-40" token that listings carry.
 * - Exit aliases: "ex 81", "exit81" → "exit 81" (the indexed haystack token).
 * - Brand aliases: "loves" → "love's", "flyingj" → "flying j", "qt" →
 *   "quiktrip", … so the spellings drivers actually type match the official
 *   business names stored on listings.
 * - City-word aliases: "ft"/"mt"/"st" ↔ "fort"/"mount"/"saint".
 * - Fuzzy token matching: one edit of slack on words of 5+ letters, so
 *   "knoxvile" still finds Knoxville — but never on short tokens where a
 *   single edit changes the word entirely.
 * - Field-weighted relevance ranking (name > brand > city > exit >
 *   interstate > category/amenities > description), used when a query is
 *   present and the sort is the default; explicit A–Z/newest/distance sorts
 *   keep their order and only use the matcher as a filter.
 */

/** Canonical spelling → the alternate spellings drivers type. */
export const BRAND_ALIASES: Record<string, string[]> = {
  "love's": ['loves', 'love s'],
  'flying j': ['flyingj', 'flying-j'],
  quiktrip: ['qt', 'quick trip', 'quicktrip'],
  'travelcenters of america': ['ta', 't/a', 'travel centers of america'],
  one9: ['one 9', 'one-9', 'one nine'],
  'cat scale': ['catscale', 'cat scales'],
  'blue beacon': ['bluebeacon'],
  "weigel's": ['weigels', 'weigel'],
  'southern tire mart': ['stm'],
  speedco: ['speed co'],
  'road ranger': ['roadranger'],
  petro: ['petro stopping center'],
};

/** Word-level city aliases, applied in both directions. */
const WORD_ALIASES: [string, string][] = [
  ['ft', 'fort'],
  ['mt', 'mount'],
  ['st', 'saint'],
];

/**
 * Normalize the raw query: canonicalize interstate mentions ("I40",
 * "Interstate 40" → "i-40") and exit mentions ("ex 81", "exit81" →
 * "exit 81"), lowercase, collapse whitespace.
 */
export function normalizeQuery(raw: string): string {
  let q = raw.toLowerCase().trim().replace(/\s+/g, ' ');
  // "interstate 40" / "i 40" / "i40" / "i-40" → "i-40"
  q = q.replace(/\b(?:interstate\s+|i[\s-]?)(\d{1,3})\b/g, 'i-$1');
  // "exit81" / "ex 81" / "ex. 81" → "exit 81"
  q = q.replace(/\bex(?:it)?\.?\s*(\d+[a-z]?)\b/g, 'exit $1');
  return q;
}

/**
 * Expand a normalized query into equivalent phrasings via brand and city-word
 * aliases. The original phrasing is always first.
 */
export function expandQuery(normalized: string): string[] {
  const variants = new Set<string>([normalized]);
  for (const [canonical, aliases] of Object.entries(BRAND_ALIASES)) {
    for (const alias of aliases) {
      for (const v of [...variants]) {
        if (v.includes(alias)) variants.add(v.split(alias).join(canonical));
        if (v.includes(canonical)) variants.add(v.split(canonical).join(alias));
      }
    }
  }
  for (const [short, long] of WORD_ALIASES) {
    for (const v of [...variants]) {
      const words = v.split(' ');
      if (words.includes(short)) {
        variants.add(words.map((w) => (w === short ? long : w)).join(' '));
      }
      if (words.includes(long)) {
        variants.add(words.map((w) => (w === long ? short : w)).join(' '));
      }
    }
  }
  return [...variants];
}

/** Levenshtein distance capped at 2 (early exit — we only care about ≤1). */
export function editDistanceAtMost1(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  // One substitution
  if (la === lb) {
    let diff = 0;
    for (let i = 0; i < la; i++) if (a[i] !== b[i]) diff++;
    return diff <= 1;
  }
  // One insertion/deletion
  const [short, long] = la < lb ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i++;
      j++;
    } else {
      if (skipped) return false;
      skipped = true;
      j++;
    }
  }
  return true;
}

type Field = {
  text: string;
  weight: number;
};

function fieldsOf(e: DirectoryEntry): Field[] {
  return [
    { text: e.name, weight: 100 },
    { text: e.city, weight: 80 },
    { text: e.exitNumber ? `exit ${e.exitNumber}` : '', weight: 70 },
    { text: [e.interstate, e.state, e.zip].filter(Boolean).join(' '), weight: 60 },
    {
      text: [getCategory(e.category)?.title, ...(e.amenities ?? [])].filter(Boolean).join(' '),
      weight: 40,
    },
    { text: e.description ?? '', weight: 10 },
  ].map((f) => ({ ...f, text: f.text.toLowerCase() }));
}

/**
 * Score one entry against the expanded query variants. Returns 0 for no
 * match. AND semantics across tokens: every token of at least one variant
 * must hit some field (substring first, fuzzy fallback for tokens of 5+
 * letters at 60% credit).
 */
export function scoreEntry(e: DirectoryEntry, variants: string[]): number {
  const fields = fieldsOf(e);
  let best = 0;
  for (const variant of variants) {
    if (!variant) continue;
    // Whole-phrase hit on a field is the strongest signal.
    let phraseScore = 0;
    for (const f of fields) {
      if (!f.text) continue;
      if (f.text === variant) phraseScore = Math.max(phraseScore, f.weight * 2);
      else if (f.text.startsWith(variant)) phraseScore = Math.max(phraseScore, f.weight * 1.5);
      else if (f.text.includes(variant)) phraseScore = Math.max(phraseScore, f.weight);
    }
    // Token AND: every token must match somewhere.
    const tokens = variant.split(' ').filter(Boolean);
    let tokenTotal = 0;
    let allMatched = true;
    for (const t of tokens) {
      let tokenBest = 0;
      for (const f of fields) {
        if (!f.text) continue;
        if (f.text.includes(t)) {
          tokenBest = Math.max(tokenBest, f.weight);
        } else if (t.length >= 5) {
          for (const word of f.text.split(/[^a-z0-9']+/)) {
            if (word && editDistanceAtMost1(t, word)) {
              tokenBest = Math.max(tokenBest, f.weight * 0.6);
              break;
            }
          }
        }
      }
      if (tokenBest === 0) {
        allMatched = false;
        break;
      }
      tokenTotal += tokenBest;
    }
    const variantScore = Math.max(phraseScore, allMatched ? tokenTotal / tokens.length : 0);
    best = Math.max(best, variantScore);
  }
  return best;
}

export type RankedEntry = { entry: DirectoryEntry; score: number };

/**
 * Match + rank entries for a raw query. Empty query matches everything at
 * score 0 (callers keep their own default ordering). Featured listings get a
 * small tie-break boost so equally relevant featured entries surface first.
 */
export function rankEntries(entries: DirectoryEntry[], rawQuery: string): RankedEntry[] {
  const normalized = normalizeQuery(rawQuery);
  if (!normalized) return entries.map((entry) => ({ entry, score: 0 }));
  const variants = expandQuery(normalized);
  const ranked: RankedEntry[] = [];
  for (const entry of entries) {
    const score = scoreEntry(entry, variants);
    if (score > 0) ranked.push({ entry, score: score + (entry.featured ? 5 : 0) });
  }
  ranked.sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name));
  return ranked;
}
