/**
 * Lead funnel — read-only display helpers.
 *
 * Pure logic, no sending and no provider. Maps a lead's source to a
 * newsletter segment (so the owner can plan targeted campaigns the day email
 * turns on) and summarizes UTM data for the admin lead list.
 *
 * NOTE: this intentionally does NOT include any lead upsert / first-touch
 * merge logic. Changing `/api/lead` write or consent semantics is out of
 * scope for this work block; this module is display-only.
 */

/** Canonical lead sources currently written by the platform. */
export const LEAD_SOURCES = ['newsletter', 'founder', 'practice-test'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

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
