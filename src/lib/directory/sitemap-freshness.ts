/**
 * Sitemap freshness (SEO). Directory hub pages (category / state / interstate /
 * exit) are aggregations of published listings, so their true "last modified"
 * is the newest `updated_at` among the listings they contain — not the moment
 * the sitemap was generated. Stamping every hub with `now` gives Google a noisy,
 * uniform freshness signal and wastes crawl budget; deriving it from the data
 * gives an honest one.
 *
 * Pure and dependency-free so it can be unit-tested without a database.
 */

export type FreshnessInput = {
  category: string;
  state: string;
  interstate?: string;
  exitNumber?: string;
  updatedAt?: string;
};

export type FreshnessMaps = {
  /** Newest updated_at across ALL entries (ms epoch), or null if none. */
  global: number | null;
  byCategory: Map<string, number>;
  byState: Map<string, number>;
  byInterstate: Map<string, number>;
  /** Keyed by `exitKey(interstate, exitNumber)`. */
  byExit: Map<string, number>;
};

/** Stable composite key for an interstate + exit bucket. */
export function exitKey(interstate: string, exitNumber: string): string {
  return `${interstate}|${exitNumber}`;
}

const bumpMax = (map: Map<string, number>, key: string, ts: number) => {
  const prev = map.get(key);
  if (prev == null || ts > prev) map.set(key, ts);
};

/**
 * Fold published entries into per-facet newest-timestamp maps. Entries with a
 * missing or unparseable `updatedAt` are ignored (they simply don't advance a
 * bucket's freshness), so a hub with no dated rows falls back to `now` at the
 * call site.
 */
export function computeFreshness(entries: FreshnessInput[]): FreshnessMaps {
  const maps: FreshnessMaps = {
    global: null,
    byCategory: new Map(),
    byState: new Map(),
    byInterstate: new Map(),
    byExit: new Map(),
  };
  for (const e of entries) {
    if (!e.updatedAt) continue;
    const ts = Date.parse(e.updatedAt);
    if (Number.isNaN(ts)) continue;
    if (maps.global == null || ts > maps.global) maps.global = ts;
    if (e.category) bumpMax(maps.byCategory, e.category, ts);
    if (e.state) bumpMax(maps.byState, e.state.toUpperCase(), ts);
    if (e.interstate) {
      bumpMax(maps.byInterstate, e.interstate, ts);
      if (e.exitNumber) bumpMax(maps.byExit, exitKey(e.interstate, e.exitNumber), ts);
    }
  }
  return maps;
}

/** Timestamp (ms) → Date, falling back to `fallback` when null/undefined. */
export function lastModifiedOr(ts: number | null | undefined, fallback: Date): Date {
  return ts == null ? fallback : new Date(ts);
}
