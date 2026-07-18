import { normalizeInterstate } from './coordinate-verification';
import { parseExitNumber } from './interpolation';

/**
 * Interstate concurrency normalization (Phase 2B, Step 4). Where two
 * interstates share pavement, exits carry ONE route's milepost scheme; a
 * listing tagged with the other route ends up with a milepost that is
 * impossible for that corridor (the Knoxville Watt Road cluster is tagged
 * I-75 with I-40's exit 369). Interpolating those rows against the tagged
 * corridor's calibration would be wrong, so calibration and the pipeline key
 * such rows to the corridor that OWNS the exit numbers instead.
 *
 * Rules of the module:
 * - NON-DESTRUCTIVE: nothing here rewrites `interstate` or `exit_number` on
 *   a listing. The original tag is preserved everywhere; normalization only
 *   adds a canonical corridor + alias list for milepost math and reporting.
 * - CONSERVATIVE: only documented concurrency segments in states the
 *   directory covers are normalized. Anything else passes through unchanged.
 * - IDENTITY-SAFE: one listing stays one listing — normalization never
 *   creates rows, never touches slugs, and the listing id rides through.
 */

export type ConcurrencyRule = {
  /** Two-letter state the rule applies in. */
  state: string;
  /** Interstate label as tagged on the listing (normalized form). */
  tagged: string;
  /** Inclusive exit-number range that belongs to the canonical corridor. */
  minExit: number;
  maxExit: number;
  /** Corridor whose milepost scheme the exits actually follow. */
  canonical: string;
  /** Human-readable justification, kept in reports. */
  reason: string;
};

/**
 * Documented concurrency segments relevant to the current directory data.
 * Extend this table (with a reason) as corridors grow — rules are data, not
 * code.
 */
export const CONCURRENCY_RULES: ConcurrencyRule[] = [
  {
    state: 'TN',
    tagged: 'I-75',
    minExit: 368,
    maxExit: 385,
    canonical: 'I-40',
    reason:
      'I-40/I-75 run concurrent west of Knoxville (I-40 mileposts ~368–385); exits in this range (e.g. 369 Watt Road, 374, 376, 378, 380, 383) follow I-40 mileposts, far beyond I-75 TN’s own ~161-mile range.',
  },
  {
    state: 'TN',
    tagged: 'I-24',
    minExit: 200,
    maxExit: 216,
    canonical: 'I-40',
    reason:
      'I-24/I-40 run concurrent through Nashville (I-40 mileposts ~206–213); listings tagged I-24 with exit numbers in the low 200s — impossible for I-24 TN’s own ~185-mile range — are on I-40’s scheme.',
  },
];

export type CorridorResolution = {
  /** Corridor key whose milepost scheme the exit follows. */
  canonical: string;
  /** The listing's original tag (normalized), always preserved. */
  tagged: string;
  /** All corridor labels this listing can be found under. */
  aliases: string[];
  /** The rule that fired, if any. */
  rule: ConcurrencyRule | null;
};

/**
 * Resolve the corridor whose milepost scheme a listing's exit number
 * follows. When no rule matches (including missing/unparseable exits), the
 * tagged corridor passes through unchanged.
 */
export function resolveCorridor(
  state: string | null | undefined,
  interstate: string | null | undefined,
  exitNumber: string | null | undefined,
): CorridorResolution {
  const tagged = normalizeInterstate(interstate);
  const st = (state ?? '').trim().toUpperCase();
  const milepost = parseExitNumber(exitNumber);
  const base: CorridorResolution = {
    canonical: tagged,
    tagged,
    aliases: tagged ? [tagged] : [],
    rule: null,
  };
  if (!tagged || milepost === null) return base;
  const rule = CONCURRENCY_RULES.find(
    (r) => r.state === st && r.tagged === tagged && milepost >= r.minExit && milepost <= r.maxExit,
  );
  if (!rule) return base;
  return {
    canonical: rule.canonical,
    tagged,
    aliases: [rule.canonical, tagged],
    rule,
  };
}

/**
 * Report helper: rows whose corridor changed under normalization, with the
 * reason — the "concurrency conflicts" section of the dry-run report.
 */
export function concurrencyReport(
  rows: { id: string; name: string; state: string; interstate: string; exitNumber: string }[],
): {
  id: string;
  name: string;
  state: string;
  tagged: string;
  canonical: string;
  exit: string;
  reason: string;
}[] {
  const out = [];
  for (const row of rows) {
    const res = resolveCorridor(row.state, row.interstate, row.exitNumber);
    if (res.rule) {
      out.push({
        id: row.id,
        name: row.name,
        state: row.state,
        tagged: res.tagged,
        canonical: res.canonical,
        exit: row.exitNumber,
        reason: res.rule.reason,
      });
    }
  }
  return out;
}
