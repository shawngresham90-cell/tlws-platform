/**
 * Lead funnel — read-only display helpers.
 *
 * Pure logic, no sending and no provider. Maps a lead's source to a
 * newsletter segment (so the owner can plan targeted campaigns the day email
 * turns on) and summarizes UTM data for the admin lead list.
 *
 * NOTE: this intentionally holds no lead write logic. What a repeat submission
 * may and may not change lives in `lib/leads/merge.ts`; this module only names
 * and displays what was written.
 */

/**
 * Canonical lead sources currently written by the platform. Each one is a value
 * some route actually passes to `leads.source` today:
 *   newsletter    → NewsletterForm      → POST /api/lead
 *   founder       → BecomeFounderForm   → POST /api/lead
 *   practice-test → quiz email save     → POST /api/tests/attempt
 *
 * Nothing speculative belongs here. A source listed before anything writes it
 * produces a permanently empty admin bucket that reads as "no signups yet"
 * rather than "this does not exist", which is worse than no bucket at all.
 * Sources that appear in the data without appearing here are not lost — they
 * fall into the `other` filter and the `Unsegmented` label below.
 */
export const LEAD_SOURCES = ['newsletter', 'founder', 'practice-test'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

/**
 * Which slice of the lead table to read.
 *
 * `other` is not a leftover — it is the point. `leads.source` accepts any
 * string, so a future form can start writing a value nobody added above.
 * Without this case such rows would be counted in the total, absent from every
 * per-source bucket, and unreachable in the list: silently mis-segmented. Given
 * a bucket, drift surfaces as a number the owner can click.
 */
export type LeadFilter =
  | { kind: 'all' }
  | { kind: 'source'; source: LeadSource }
  | { kind: 'other' };

function isLeadSource(value: string): value is LeadSource {
  return (LEAD_SOURCES as readonly string[]).includes(value);
}

/**
 * Map a `?source=` query param to a filter. Anything unrecognised — a typo, a
 * stale bookmark, a hand-edited URL — falls back to `all` rather than querying
 * for it, so the page cannot render an empty list that looks like "no leads
 * from this source" when the source never existed.
 */
export function parseLeadFilter(value: string | string[] | undefined): LeadFilter {
  const raw = (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
  if (raw === 'other') return { kind: 'other' };
  return isLeadSource(raw) ? { kind: 'source', source: raw } : { kind: 'all' };
}

/** The `?source=` value that round-trips back to this filter. Empty means "no param". */
export function leadFilterParam(filter: LeadFilter): string {
  return filter.kind === 'all' ? '' : filter.kind === 'other' ? 'other' : filter.source;
}

export type LeadSegment = {
  /** Stable segment key for future email tooling. */
  key: string;
  /** Human name shown in admin. */
  label: string;
};

const SEGMENTS: Record<string, LeadSegment> = {
  newsletter: { key: 'driver-general', label: 'Drivers — general' },
  founder: { key: 'supporters', label: 'Supporters — founders' },
  'practice-test': { key: 'students-cdl-prep', label: 'Students — CDL prep' },
};

const FALLBACK_SEGMENT: LeadSegment = { key: 'unsegmented', label: 'Unsegmented' };

/** Segment for a lead's source. Unknown/blank sources fall back safely. */
export function segmentFor(source: string | null | undefined): LeadSegment {
  if (!source) return FALLBACK_SEGMENT;
  return Object.hasOwn(SEGMENTS, source) ? SEGMENTS[source] : FALLBACK_SEGMENT;
}

/**
 * Short human summary of a lead's UTM data for the admin list, e.g.
 * "youtube · dot-guide". Returns null when there's nothing useful to show.
 * Never throws on malformed/foreign JSON.
 */
export function utmSummary(utm: unknown): string | null {
  if (!utm || typeof utm !== 'object') return null;
  const rec = utm as Record<string, unknown>;
  const pick = (k: string) => (typeof rec[k] === 'string' ? (rec[k] as string) : '');
  const source = pick('utm_source');
  const campaign = pick('utm_campaign');
  const medium = pick('utm_medium');
  const parts = [source, campaign || medium].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
